use crate::command::ConsumerResponse;

pub(super) fn log_command_response(
    command_id: &str,
    command: &str,
    provider: &str,
    response: &ConsumerResponse,
    duration_ms: u128,
) {
    if response.ok {
        tracing::info!(
            event_name = "command.finish",
            source = "service-runtime",
            command_id = %command_id,
            command = %command,
            provider = %provider,
            ok = true,
            duration_ms
        );
        tracing::debug!(
            event_name = "command.result",
            source = "service-runtime",
            command_id = %command_id,
            command = %command,
            provider = %provider,
            result = ?response.result
        );
        return;
    }

    let error_code = response
        .error
        .as_ref()
        .map_or("unknown", |error| error.code.as_str());
    let error_message = response
        .error
        .as_ref()
        .map_or("missing runtime error", |error| error.message.as_str());

    if matches!(error_code, "provider_error" | "local_store_error") {
        tracing::error!(
            event_name = "command.finish",
            source = "service-runtime",
            command_id = %command_id,
            command = %command,
            provider = %provider,
            ok = false,
            duration_ms,
            error_code = %error_code,
            error_message = %error_message
        );
    } else {
        tracing::warn!(
            event_name = "command.finish",
            source = "service-runtime",
            command_id = %command_id,
            command = %command,
            provider = %provider,
            ok = false,
            duration_ms,
            error_code = %error_code,
            error_message = %error_message
        );
    }
}
