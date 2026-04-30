#[derive(Default)]
struct PromptUpdateState {
    active_session: Option<String>,
    raw_update_count: usize,
    agent_text_chunks: Vec<String>,
    updates: Vec<TranscriptUpdateSnapshot>,
    update_sender: Option<Sender<TranscriptUpdateSnapshot>>,
    next_interaction_id: u64,
    interaction_queue_by_tool_call: BTreeMap<String, VecDeque<String>>,
}

struct PromptUpdates {
    raw_update_count: usize,
    agent_text_chunks: Vec<String>,
    updates: Vec<TranscriptUpdateSnapshot>,
}

#[derive(Clone)]
struct SdkClient {
    provider: ProviderId,
    updates: Arc<Mutex<PromptUpdateState>>,
}

impl SdkClient {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> acp_sdk::Result<acp::RequestPermissionResponse> {
        let session_id = args.session_id.to_string();
        let tool_call_id = args.tool_call.tool_call_id.to_string();
        let question = question_details(&args)?;
        let (response_tx, response_rx) = oneshot::channel();
        {
            let mut updates = self.updates.lock().map_err(|error| {
                acp_sdk::Error::internal_error().data(format!(
                    "prompt update lock poisoned for {}: {error}",
                    self.provider
                ))
            })?;
            if updates.active_session.as_deref() != Some(session_id.as_str()) {
                return Ok(acp::RequestPermissionResponse::new(
                    acp::RequestPermissionOutcome::Cancelled,
                ));
            }
            let interaction_id = next_interaction_id(&mut updates);
            register_pending_interaction(
                self.provider,
                session_id.clone(),
                interaction_id.clone(),
                response_tx,
            )
            .map_err(|error| acp_sdk::Error::internal_error().data(error.to_string()))?;
            updates
                .interaction_queue_by_tool_call
                .entry(tool_call_id.clone())
                .or_default()
                .push_back(interaction_id.clone());
            let update = interaction_request_update(
                &mut updates,
                interaction_id,
                tool_call_id,
                &question,
                args.tool_call.fields.raw_input.as_ref(),
            )?;
            record_update(&mut updates, update);
        }
        Ok(response_rx.await.unwrap_or_else(|_error| {
            acp::RequestPermissionResponse::new(acp::RequestPermissionOutcome::Cancelled)
        }))
    }

    async fn session_notification(&self, args: acp::SessionNotification) -> acp_sdk::Result<()> {
        let mut updates = self.updates.lock().map_err(|error| {
            acp_sdk::Error::internal_error().data(format!(
                "prompt update lock poisoned for {}: {error}",
                self.provider
            ))
        })?;
        if updates.active_session.as_deref() == Some(&args.session_id.to_string()) {
            let update = to_value(&args.update).map_err(|error| {
                acp_sdk::Error::internal_error().data(format!(
                    "session update serialization failed for {}: {error}",
                    self.provider
                ))
            })?;
            let variant = session_update_variant(&args.update, &update);
            let index = next_update_index(&mut updates);
            record_update(
                &mut updates,
                TranscriptUpdateSnapshot {
                    index,
                    variant,
                    update: update.clone(),
                },
            );
            if let acp::SessionUpdate::AgentMessageChunk(chunk) = &args.update
                && let acp::ContentBlock::Text(text) = &chunk.content
            {
                updates.agent_text_chunks.push(text.text.clone());
            }
            if let acp::SessionUpdate::ToolCallUpdate(tool_call_update) = &args.update
                && let Some(snapshot) =
                    interaction_resolution_update(&mut updates, tool_call_update, &update)?
            {
                record_update(&mut updates, snapshot);
            }
        }
        Ok(())
    }
}

#[derive(Clone)]
struct InteractionQuestion {
    id: String,
    header: Option<String>,
    prompt: String,
    is_other: bool,
    options: Vec<ConduitInteractionOption>,
}

fn question_details(args: &acp::RequestPermissionRequest) -> acp_sdk::Result<InteractionQuestion> {
    let raw_input = args.tool_call.fields.raw_input.as_ref();
    let id = required_question_string(raw_input, "/question/id", "question.id")?;
    let header = raw_input
        .and_then(|value| value.pointer("/question/header"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let prompt = required_question_string(raw_input, "/question/question", "question.question")?;
    let is_other = raw_input
        .and_then(|value| value.pointer("/question/isOther"))
        .and_then(Value::as_bool)
        .unwrap_or_else(|| {
            args.options
                .iter()
                .any(|option| option.option_id.0.as_ref() == "answer-other")
        });
    let options = args
        .options
        .iter()
        .map(|option| {
            Ok(ConduitInteractionOption::new(
                option_kind_string(option.kind)?,
                option.name.clone(),
                option.option_id.0.as_ref().to_owned(),
            ))
        })
        .collect::<acp_sdk::Result<Vec<_>>>()?;
    Ok(InteractionQuestion {
        id,
        header,
        prompt,
        is_other,
        options,
    })
}

fn required_question_string(
    raw_input: Option<&Value>,
    pointer: &'static str,
    field: &'static str,
) -> acp_sdk::Result<String> {
    raw_input
        .and_then(|value| value.pointer(pointer))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| protocol_event_error(format!("request permission payload missing {field}")))
}

fn option_kind_string(kind: acp::PermissionOptionKind) -> acp_sdk::Result<String> {
    let value = to_value(kind).map_err(|error| {
        protocol_event_error(format!("permission option kind serialization failed: {error}"))
    })?;
    value
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| protocol_event_error("permission option kind did not serialize as string"))
}

fn next_update_index(updates: &mut PromptUpdateState) -> usize {
    updates.raw_update_count += 1;
    updates.raw_update_count.saturating_sub(1)
}

fn next_interaction_id(updates: &mut PromptUpdateState) -> String {
    updates.next_interaction_id = updates.next_interaction_id.saturating_add(1);
    format!("interaction-{}", updates.next_interaction_id)
}

fn interaction_request_update(
    updates: &mut PromptUpdateState,
    interaction_id: String,
    tool_call_id: String,
    question: &InteractionQuestion,
    raw_input: Option<&Value>,
) -> acp_sdk::Result<TranscriptUpdateSnapshot> {
    let data = ConduitInteractionRequestData::new(ConduitInteractionRequestInput {
        interaction_id,
        tool_call_id,
        question_id: question.id.clone(),
        question_header: question.header.clone(),
        question: question.prompt.clone(),
        is_other: question.is_other,
        options: question.options.clone(),
        raw_input: raw_input.cloned().unwrap_or(Value::Null),
    });
    Ok(TranscriptUpdateSnapshot {
        index: next_update_index(updates),
        variant: "interaction_request".to_owned(),
        update: to_value(data).map_err(|error| {
            protocol_event_error(format!("interaction request data serialization failed: {error}"))
        })?,
    })
}

fn interaction_resolution_update(
    updates: &mut PromptUpdateState,
    update: &acp::ToolCallUpdate,
    update_value: &Value,
) -> acp_sdk::Result<Option<TranscriptUpdateSnapshot>> {
    let Some(status) = interaction_terminal_status(update, update_value) else {
        return Ok(None);
    };
    let tool_call_id = update.tool_call_id.to_string();
    let Some(queue) = updates.interaction_queue_by_tool_call.get_mut(&tool_call_id) else {
        return Ok(None);
    };
    let Some(interaction_id) = queue.pop_front() else {
        return Ok(None);
    };
    if queue.is_empty() {
        updates.interaction_queue_by_tool_call.remove(&tool_call_id);
    }
    let raw_output = update_value
        .get("rawOutput")
        .cloned()
        .unwrap_or(Value::Null);
    let data = ConduitInteractionResolutionData::new(
        interaction_id,
        tool_call_id,
        status,
        raw_output,
    );
    Ok(Some(TranscriptUpdateSnapshot {
        index: next_update_index(updates),
        variant: "interaction_resolution".to_owned(),
        update: to_value(data).map_err(|error| {
            protocol_event_error(format!(
                "interaction resolution data serialization failed: {error}"
            ))
        })?,
    }))
}

fn interaction_terminal_status(
    update: &acp::ToolCallUpdate,
    update_value: &Value,
) -> Option<ConduitInteractionResolutionStatus> {
    let raw_outcome = update_value
        .get("rawOutput")
        .and_then(|value| value.get("outcome"))
        .and_then(Value::as_str);
    match update.fields.status {
        Some(acp::ToolCallStatus::Completed) => Some(ConduitInteractionResolutionStatus::Resolved),
        Some(acp::ToolCallStatus::Failed) if raw_outcome == Some("cancelled") => {
            Some(ConduitInteractionResolutionStatus::Cancelled)
        }
        Some(acp::ToolCallStatus::Failed) => Some(ConduitInteractionResolutionStatus::Failed),
        _ => None,
    }
}

fn protocol_event_error(message: impl Into<String>) -> acp_sdk::Error {
    acp_sdk::Error::internal_error().data(message.into())
}

fn record_update(updates: &mut PromptUpdateState, snapshot: TranscriptUpdateSnapshot) {
    if let Some(update_sender) = &updates.update_sender {
        let _result = update_sender.send(snapshot.clone());
    }
    updates.updates.push(snapshot);
}

pub(super) struct ActorBootstrap {
    pub(super) provider: ProviderId,
    pub(super) discovery: ProviderDiscovery,
    pub(super) launcher: LauncherCommand,
    pub(super) environment: ProcessEnvironment,
    pub(super) commands: UnboundedReceiver<HostCommand>,
    pub(super) init: Sender<Result<()>>,
}

pub(super) fn spawn_actor(bootstrap: ActorBootstrap) -> Result<()> {
    let provider = bootstrap.provider;
    thread::Builder::new()
        .name(format!("conduit-acp-host-{provider}"))
        .spawn(move || run_actor_thread(bootstrap))
        .map(|_handle| ())
        .map_err(|source| AcpError::Spawn { provider, source })
}

fn run_actor_thread(bootstrap: ActorBootstrap) {
    let provider = bootstrap.provider;
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            send_reply(bootstrap.init, Err(unexpected(provider, error.to_string())));
            return;
        }
    };
    let local = tokio::task::LocalSet::new();
    local.block_on(&runtime, async move {
        run_actor(bootstrap).await;
    });
}

async fn run_actor(bootstrap: ActorBootstrap) {
    let ActorBootstrap {
        provider,
        discovery,
        launcher,
        environment,
        commands,
        init,
    } = bootstrap;
    let updates = Arc::new(Mutex::new(PromptUpdateState::default()));
    let (transport, child) = match SdkHostActor::spawn_transport(provider, &launcher, &environment)
    {
        Ok(process) => process,
        Err(error) => {
            send_reply(init, Err(error));
            return;
        }
    };
    let client = SdkClient {
        provider,
        updates: Arc::clone(&updates),
    };
    send_reply(init, Ok(()));
    let result = connect_sdk_client(
        SdkClientConnection {
            provider,
            discovery,
            commands,
            updates,
            transport,
            child,
        },
        client,
    )
    .await;
    if let Err(error) = result {
        tracing::warn!(
            event_name = "acp_host.connection.finish",
            source = "acp-core",
            provider = %provider.as_str(),
            ok = false,
            error_message = %error
        );
    }
}

struct SdkClientConnection {
    provider: ProviderId,
    discovery: ProviderDiscovery,
    commands: UnboundedReceiver<HostCommand>,
    updates: Arc<Mutex<PromptUpdateState>>,
    transport: SdkTransport,
    child: tokio::process::Child,
}

async fn connect_sdk_client(args: SdkClientConnection, client: SdkClient) -> acp_sdk::Result<()> {
    acp_sdk::Client
        .builder()
        .on_receive_request(
            {
                let client = client.clone();
                async move |request, responder, connection| {
                    respond_to_permission_request(client.clone(), request, responder, connection)
                }
            },
            acp_sdk::on_receive_request!(),
        )
        .on_receive_notification(
            async move |notification, _connection| client.session_notification(notification).await,
            acp_sdk::on_receive_notification!(),
        )
        .connect_with(args.transport, async move |connection| {
            SdkHostActor::run_connected(ConnectedActor {
                provider: args.provider,
                discovery: args.discovery,
                child: args.child,
                connection,
                updates: args.updates,
                commands: args.commands,
            })
            .await
            .map_err(|error| acp_sdk::Error::internal_error().data(error.to_string()))?;
            Ok(())
        })
        .await
}

fn respond_to_permission_request(
    client: SdkClient,
    request: acp::RequestPermissionRequest,
    responder: acp_sdk::Responder<acp::RequestPermissionResponse>,
    connection: SdkConnection,
) -> acp_sdk::Result<()> {
    connection
        .spawn(async move { responder.respond_with_result(client.request_permission(request).await) })?;
    Ok(())
}

fn child_stdin(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<SdkChildStdin> {
    child
        .stdin
        .take()
        .map(TokioAsyncWriteCompatExt::compat_write)
        .ok_or_else(|| disconnected(provider, "stdin"))
}

fn child_stdout(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<SdkChildStdout> {
    child
        .stdout
        .take()
        .map(TokioAsyncReadCompatExt::compat)
        .ok_or_else(|| disconnected(provider, "stdout"))
}

fn update_session_tracker(
    updates: &Arc<Mutex<PromptUpdateState>>,
    active_session: Option<String>,
    raw_update_count: usize,
    update_sender: Option<Sender<TranscriptUpdateSnapshot>>,
    provider: ProviderId,
) -> Result<()> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    if let Some(session_id) = updates.active_session.as_ref() {
        cancel_pending_interactions_for_session(provider, session_id);
    }
    updates.active_session = active_session;
    updates.raw_update_count = raw_update_count;
    updates.agent_text_chunks.clear();
    updates.updates.clear();
    updates.update_sender = update_sender;
    updates.next_interaction_id = 0;
    updates.interaction_queue_by_tool_call.clear();
    Ok(())
}

fn take_session_updates(
    updates: &Arc<Mutex<PromptUpdateState>>,
    provider: ProviderId,
) -> Result<PromptUpdates> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    if let Some(session_id) = updates.active_session.as_ref() {
        cancel_pending_interactions_for_session(provider, session_id);
    }
    let count = updates.raw_update_count;
    let agent_text_chunks = std::mem::take(&mut updates.agent_text_chunks);
    let captured_updates = std::mem::take(&mut updates.updates);
    updates.active_session = None;
    updates.raw_update_count = 0;
    updates.update_sender = None;
    updates.next_interaction_id = 0;
    updates.interaction_queue_by_tool_call.clear();
    Ok(PromptUpdates {
        raw_update_count: count,
        agent_text_chunks,
        updates: captured_updates,
    })
}

pub(super) fn disconnected_snapshot(
    provider: ProviderId,
    discovery: ProviderDiscovery,
) -> ProviderSnapshot {
    ProviderSnapshot {
        provider,
        connection_state: ConnectionState::Disconnected,
        discovery,
        capabilities: Value::Null,
        auth_methods: Vec::new(),
        live_sessions: Vec::new(),
        last_prompt: None,
        loaded_transcripts: Vec::new(),
    }
}

pub(super) fn receive_result<T>(
    provider: ProviderId,
    operation: &'static str,
    response: Receiver<Result<T>>,
) -> Result<T> {
    response
        .recv()
        .map_err(|_error| actor_stopped(provider, operation))?
}

pub(super) fn actor_stopped(provider: ProviderId, operation: &str) -> AcpError {
    AcpError::ActorStopped {
        provider,
        operation: operation.to_owned(),
    }
}

#[cfg(test)]
mod ui_event_data_tests {
    use super::{
        InteractionQuestion, PromptUpdateState, interaction_request_update,
        interaction_resolution_update,
    };
    use crate::{
        ConduitInteractionOption, ConduitInteractionRequestData, ConduitInteractionResolutionData,
        ConduitInteractionResolutionStatus,
    };
    use agent_client_protocol::schema as acp;
    use serde_json::json;
    use std::collections::VecDeque;
    use std::error::Error;

    type TestResult = Result<(), Box<dyn Error>>;

    #[test]
    fn interaction_request_update_serializes_exported_dto() -> TestResult {
        let mut updates = PromptUpdateState::default();
        let question = InteractionQuestion {
            id: "question-1".to_owned(),
            header: Some("Question".to_owned()),
            prompt: "Proceed?".to_owned(),
            is_other: true,
            options: vec![ConduitInteractionOption::new(
                "allow_once".to_owned(),
                "Yes".to_owned(),
                "yes".to_owned(),
            )],
        };

        let snapshot = interaction_request_update(
            &mut updates,
            "interaction-1".to_owned(),
            "tool-call-1".to_owned(),
            &question,
            Some(&json!({ "question": { "id": "question-1" } })),
        )?;

        let data: ConduitInteractionRequestData = serde_json::from_value(snapshot.update)?;
        ensure_eq(
            &snapshot.variant.as_str(),
            &"interaction_request",
            "snapshot variant",
        )?;
        ensure_eq(&data.session_update.as_str(), &"interaction_request", "session update")?;
        ensure_eq(&data.request_type.as_str(), &"request_user_input", "request type")?;
        ensure_eq(&data.status.as_str(), &"pending", "request status")?;
        ensure_eq(&data.question_id.as_str(), &"question-1", "question id")?;
        Ok(())
    }

    #[test]
    fn interaction_resolution_update_serializes_exported_dto() -> TestResult {
        let mut updates = PromptUpdateState::default();
        updates.interaction_queue_by_tool_call.insert(
            "tool-call-1".to_owned(),
            VecDeque::from(["interaction-1".to_owned()]),
        );
        let update = acp::ToolCallUpdate::new(
            "tool-call-1",
            acp::ToolCallUpdateFields::new().status(acp::ToolCallStatus::Completed),
        );
        let update_value = json!({
            "toolCallId": "tool-call-1",
            "status": "completed",
            "rawOutput": { "outcome": "approved" }
        });

        let Some(snapshot) = interaction_resolution_update(&mut updates, &update, &update_value)?
        else {
            return Err(std::io::Error::other("expected interaction resolution snapshot").into());
        };

        let data: ConduitInteractionResolutionData = serde_json::from_value(snapshot.update)?;
        ensure_eq(
            &snapshot.variant.as_str(),
            &"interaction_resolution",
            "snapshot variant",
        )?;
        ensure_eq(
            &data.session_update.as_str(),
            &"interaction_resolution",
            "session update",
        )?;
        ensure_eq(
            &data.status,
            &ConduitInteractionResolutionStatus::Resolved,
            "resolution status",
        )?;
        ensure_eq(&data.tool_call_id.as_str(), &"tool-call-1", "tool call id")?;
        Ok(())
    }

    fn ensure_eq<T>(actual: &T, expected: &T, label: &str) -> TestResult
    where
        T: std::fmt::Debug + PartialEq,
    {
        if actual == expected {
            return Ok(());
        }
        Err(format!("{label}: expected {expected:?}, got {actual:?}").into())
    }
}
