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

#[async_trait::async_trait(?Send)]
impl acp::Client for SdkClient {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> acp::Result<acp::RequestPermissionResponse> {
        let session_id = args.session_id.to_string();
        let tool_call_id = args.tool_call.tool_call_id.to_string();
        let question = question_details(&args);
        let (response_tx, response_rx) = oneshot::channel();
        {
            let mut updates = self.updates.lock().map_err(|error| {
                acp::Error::internal_error().data(format!(
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
                PendingInteraction { response_tx },
            )
            .map_err(|error| acp::Error::internal_error().data(error.to_string()))?;
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
            );
            record_update(&mut updates, update);
        }
        Ok(response_rx.await.unwrap_or_else(|_error| {
            acp::RequestPermissionResponse::new(acp::RequestPermissionOutcome::Cancelled)
        }))
    }

    async fn session_notification(&self, args: acp::SessionNotification) -> acp::Result<()> {
        let mut updates = self.updates.lock().map_err(|error| {
            acp::Error::internal_error().data(format!(
                "prompt update lock poisoned for {}: {error}",
                self.provider
            ))
        })?;
        if updates.active_session.as_deref() == Some(&args.session_id.to_string()) {
            let update = to_value(&args.update).map_err(|error| {
                acp::Error::internal_error().data(format!(
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
                    interaction_resolution_update(&mut updates, tool_call_update, &update)
            {
                record_update(&mut updates, snapshot);
            }
        }
        Ok(())
    }
}

#[derive(Clone)]
struct InteractionQuestion {
    id: Option<String>,
    header: Option<String>,
    prompt: Option<String>,
    is_other: bool,
    options: Vec<Value>,
}

fn question_details(args: &acp::RequestPermissionRequest) -> InteractionQuestion {
    let raw_input = args.tool_call.fields.raw_input.as_ref();
    let id = raw_input
        .and_then(|value| value.pointer("/question/id"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let header = raw_input
        .and_then(|value| value.pointer("/question/header"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let prompt = raw_input
        .and_then(|value| value.pointer("/question/question"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
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
            json!({
                "optionId": option.option_id.0.as_ref(),
                "name": option.name,
                "kind": option.kind
            })
        })
        .collect();
    InteractionQuestion {
        id,
        header,
        prompt,
        is_other,
        options,
    }
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
) -> TranscriptUpdateSnapshot {
    TranscriptUpdateSnapshot {
        index: next_update_index(updates),
        variant: "interaction_request".to_owned(),
        update: json!({
            "sessionUpdate": "interaction_request",
            "interactionId": interaction_id,
            "toolCallId": tool_call_id,
            "requestType": "request_user_input",
            "questionId": question.id,
            "questionHeader": question.header,
            "question": question.prompt,
            "isOther": question.is_other,
            "options": question.options,
            "status": "pending",
            "rawInput": raw_input.cloned().unwrap_or(Value::Null)
        }),
    }
}

fn interaction_resolution_update(
    updates: &mut PromptUpdateState,
    update: &acp::ToolCallUpdate,
    update_value: &Value,
) -> Option<TranscriptUpdateSnapshot> {
    let status = interaction_terminal_status(update, update_value)?;
    let tool_call_id = update.tool_call_id.to_string();
    let queue = updates
        .interaction_queue_by_tool_call
        .get_mut(&tool_call_id)?;
    let interaction_id = queue.pop_front()?;
    if queue.is_empty() {
        updates.interaction_queue_by_tool_call.remove(&tool_call_id);
    }
    let raw_output = update_value
        .get("rawOutput")
        .cloned()
        .unwrap_or(Value::Null);
    Some(TranscriptUpdateSnapshot {
        index: next_update_index(updates),
        variant: "interaction_resolution".to_owned(),
        update: json!({
            "sessionUpdate": "interaction_resolution",
            "interactionId": interaction_id,
            "toolCallId": tool_call_id,
            "status": status,
            "rawOutput": raw_output
        }),
    })
}

fn interaction_terminal_status(
    update: &acp::ToolCallUpdate,
    update_value: &Value,
) -> Option<&'static str> {
    let raw_outcome = update_value
        .get("rawOutput")
        .and_then(|value| value.get("outcome"))
        .and_then(Value::as_str);
    match update.fields.status {
        Some(acp::ToolCallStatus::Completed) => Some("resolved"),
        Some(acp::ToolCallStatus::Failed) if raw_outcome == Some("cancelled") => Some("cancelled"),
        Some(acp::ToolCallStatus::Failed) => Some("failed"),
        _ => None,
    }
}

fn record_update(updates: &mut PromptUpdateState, snapshot: TranscriptUpdateSnapshot) {
    if let Some(update_sender) = &updates.update_sender {
        let _result = update_sender.send(snapshot.clone());
    }
    updates.updates.push(snapshot);
}

fn register_pending_interaction(
    provider: ProviderId,
    session_id: String,
    interaction_id: String,
    pending: PendingInteraction,
) -> Result<()> {
    let key = InteractionKey {
        provider,
        session_id,
        interaction_id,
    };
    let mut registry = INTERACTION_REGISTRY
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    registry.resolved.remove(&key);
    if registry.pending.insert(key.clone(), pending).is_some() {
        return Err(AcpError::InvalidInteractionResponse {
            provider,
            interaction_id: key.interaction_id,
            message: "interaction id collision while registering pending request",
        });
    }
    Ok(())
}

fn cancel_pending_interactions_for_provider(provider: ProviderId) {
    let mut cancelled = Vec::new();
    if let Ok(mut registry) = INTERACTION_REGISTRY.lock() {
        let keys = registry
            .pending
            .keys()
            .filter(|key| key.provider == provider)
            .cloned()
            .collect::<Vec<_>>();
        for key in keys {
            if let Some(pending) = registry.pending.remove(&key) {
                cancelled.push((pending.response_tx, key.clone()));
                registry.resolved.remove(&key);
            }
        }
        registry.resolved.retain(|key| key.provider != provider);
    }
    for (response_tx, _key) in cancelled {
        let _send_status = response_tx.send(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        ));
    }
}

fn cancel_pending_interactions_for_session(provider: ProviderId, session_id: &str) {
    let mut cancelled = Vec::new();
    if let Ok(mut registry) = INTERACTION_REGISTRY.lock() {
        let keys = registry
            .pending
            .keys()
            .filter(|key| key.provider == provider && key.session_id == session_id)
            .cloned()
            .collect::<Vec<_>>();
        for key in keys {
            if let Some(pending) = registry.pending.remove(&key) {
                cancelled.push(pending.response_tx);
                registry.resolved.remove(&key);
            }
        }
        registry
            .resolved
            .retain(|key| !(key.provider == provider && key.session_id == session_id));
    }
    for response_tx in cancelled {
        let _send_status = response_tx.send(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        ));
    }
}

pub(super) struct ActorBootstrap {
    pub(super) provider: ProviderId,
    pub(super) discovery: ProviderDiscovery,
    pub(super) launcher: LauncherCommand,
    pub(super) environment: ProcessEnvironment,
    pub(super) commands: UnboundedReceiver<HostCommand>,
    pub(super) init: Sender<Result<ProviderSnapshot>>,
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
    let provider = bootstrap.provider;
    match SdkHostActor::connect(
        provider,
        bootstrap.discovery,
        bootstrap.launcher,
        bootstrap.environment,
    )
    .await
    {
        Ok(mut actor) => {
            send_reply(bootstrap.init, Ok(actor.snapshot()));
            actor.run(bootstrap.commands).await;
        }
        Err(error) => send_reply(bootstrap.init, Err(error)),
    }
}

fn spawn_sdk_connection(
    provider: ProviderId,
    launcher: &LauncherCommand,
    environment: &ProcessEnvironment,
    updates: &Arc<Mutex<PromptUpdateState>>,
) -> Result<(acp::ClientSideConnection, tokio::process::Child)> {
    let mut command = tokio::process::Command::new(&launcher.executable);
    command
        .args(&launcher.args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    apply_process_environment(&mut command, environment);
    let mut child = command
        .spawn()
        .map_err(|source| AcpError::Spawn { provider, source })?;
    let outgoing = child_stdin(provider, &mut child)?;
    let incoming = child_stdout(provider, &mut child)?;
    let client = SdkClient {
        provider,
        updates: Arc::clone(updates),
    };
    let (connection, io_task) =
        acp::ClientSideConnection::new(client, outgoing, incoming, |future| {
            tokio::task::spawn_local(future);
        });
    tokio::task::spawn_local(io_task);
    Ok((connection, child))
}

fn child_stdin(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<tokio_util::compat::Compat<tokio::process::ChildStdin>> {
    child
        .stdin
        .take()
        .map(TokioAsyncWriteCompatExt::compat_write)
        .ok_or_else(|| disconnected(provider, "stdin"))
}

fn child_stdout(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<tokio_util::compat::Compat<tokio::process::ChildStdout>> {
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
