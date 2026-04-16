use crate::command::ConsumerResponse;

struct FailureLog<'a> {
    command: &'a str,
    command_id: &'a str,
    duration_ms: u128,
    error_code: &'a str,
    error_message: &'a str,
    provider: &'a str,
}

pub(super) fn log_command_response(
    command_id: &str,
    command: &str,
    provider: &str,
    response: &ConsumerResponse,
    duration_ms: u128,
) {
    if response.ok {
        log_success(command_id, command, provider, response, duration_ms);
        return;
    }

    let (error_code, error_message) = error_fields(response);
    let context = FailureLog {
        command,
        command_id,
        duration_ms,
        error_code,
        error_message,
        provider,
    };
    log_failure(&context);
}

fn log_success(
    command_id: &str,
    command: &str,
    provider: &str,
    response: &ConsumerResponse,
    duration_ms: u128,
) {
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
}

fn error_fields(response: &ConsumerResponse) -> (&str, &str) {
    let error_code = response
        .error
        .as_ref()
        .map_or("unknown", |error| error.code.as_str());
    let error_message = response
        .error
        .as_ref()
        .map_or("missing runtime error", |error| error.message.as_str());
    (error_code, error_message)
}

fn log_failure(context: &FailureLog<'_>) {
    if is_error_level(context.error_code) {
        log_failure_error(context);
        return;
    }
    log_failure_warn(context);
}

fn is_error_level(error_code: &str) -> bool {
    matches!(error_code, "provider_error" | "local_store_error")
}

fn log_failure_error(context: &FailureLog<'_>) {
    tracing::error!(
        event_name = "command.finish",
        source = "service-runtime",
        command_id = %context.command_id,
        command = %context.command,
        provider = %context.provider,
        ok = false,
        duration_ms = context.duration_ms,
        error_code = %context.error_code,
        error_message = %context.error_message
    );
}

fn log_failure_warn(context: &FailureLog<'_>) {
    tracing::warn!(
        event_name = "command.finish",
        source = "service-runtime",
        command_id = %context.command_id,
        command = %context.command,
        provider = %context.provider,
        ok = false,
        duration_ms = context.duration_ms,
        error_code = %context.error_code,
        error_message = %context.error_message
    );
}
