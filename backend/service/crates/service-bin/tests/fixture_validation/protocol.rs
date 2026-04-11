//! Protocol capture drift validation against the locked ACP contract subset.

use super::common::{
    ValidationContext, ValidationReport, ValidationResult, envelope_id, failure,
    is_locked_request_method, read_jsonl, sorted_files, string_field,
};
use super::hygiene::validate_protocol_file_hygiene;
use acp_contracts::{
    LockedMethod, load_locked_contract_bundle, validate_locked_cancel_notification,
    validate_locked_request_envelope, validate_locked_response_envelope,
};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;

pub(crate) fn validate_protocol_provider(
    testdata_root: &Path,
    provider: &str,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let protocol_root = testdata_root
        .join("providers")
        .join(provider)
        .join("protocol");
    let bundle = load_locked_contract_bundle().map_err(|error| {
        failure(
            ValidationContext {
                provider,
                scenario: "<protocol>",
                path: &protocol_root,
            },
            format!("could not load locked ACP contract bundle: {error}"),
        )
    })?;
    for stem in protocol_capture_stems(provider, &protocol_root)? {
        validate_protocol_capture(provider, &protocol_root, &stem, &bundle, report)?;
    }
    validate_protocol_file_hygiene(&protocol_root, provider)
}

fn validate_protocol_capture(
    provider: &str,
    protocol_root: &Path,
    stem: &str,
    bundle: &acp_contracts::ContractBundle,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let methods = validate_protocol_requests(provider, protocol_root, stem, bundle)?;
    validate_protocol_responses(provider, protocol_root, stem, bundle, &methods)?;
    let event_path = protocol_root.join(format!("{stem}.events.jsonl"));
    if event_path.exists() {
        validate_protocol_events(provider, stem, &event_path, bundle, report)?;
    }
    Ok(())
}

fn validate_protocol_requests(
    provider: &str,
    protocol_root: &Path,
    stem: &str,
    bundle: &acp_contracts::ContractBundle,
) -> ValidationResult<BTreeMap<String, LockedMethod>> {
    let path = protocol_root.join(format!("{stem}.requests.jsonl"));
    let context = ValidationContext {
        provider,
        scenario: stem,
        path: &path,
    };
    let requests = read_jsonl(context)?;
    let mut methods = BTreeMap::new();
    for request in requests {
        let method_name = string_field(context, &request, "method")?;
        validate_locked_request(context, bundle, &request, method_name)?;
        if let Some(id) = envelope_id(&request) {
            let locked = locked_request_method(bundle, &request, method_name)
                .map_err(|message| failure(context, message))?;
            methods.insert(id, locked);
        }
    }
    Ok(methods)
}

fn validate_protocol_responses(
    provider: &str,
    protocol_root: &Path,
    stem: &str,
    bundle: &acp_contracts::ContractBundle,
    methods: &BTreeMap<String, LockedMethod>,
) -> ValidationResult<()> {
    let path = protocol_root.join(format!("{stem}.responses.jsonl"));
    let context = ValidationContext {
        provider,
        scenario: stem,
        path: &path,
    };
    for response in read_jsonl(context)? {
        let id = envelope_id(&response)
            .ok_or_else(|| failure(context, "protocol response missing id"))?;
        let method = methods
            .get(&id)
            .copied()
            .ok_or_else(|| failure(context, format!("response id {id} did not match request")))?;
        validate_locked_response(context, bundle, method, &response)?;
    }
    Ok(())
}

fn validate_protocol_events(
    provider: &str,
    stem: &str,
    path: &Path,
    bundle: &acp_contracts::ContractBundle,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let context = ValidationContext {
        provider,
        scenario: stem,
        path,
    };
    let mut methods = BTreeMap::new();
    for event in read_jsonl(context)? {
        let Some(envelope) = event.get("json") else {
            continue;
        };
        validate_event_payload_matches_json(context, &event, envelope)?;
        if envelope.get("method").is_some() {
            validate_protocol_event_method(context, bundle, envelope, &mut methods, report)?;
        } else if envelope.get("result").is_some() {
            validate_protocol_event_response(context, bundle, envelope, &methods)?;
        }
    }
    Ok(())
}

fn validate_protocol_event_method(
    context: ValidationContext<'_, '_>,
    bundle: &acp_contracts::ContractBundle,
    envelope: &Value,
    methods: &mut BTreeMap<String, LockedMethod>,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let method_name = string_field(context, envelope, "method")?;
    if !is_locked_request_method(method_name) && method_name != "session/cancel" {
        report.protocol_coverage_gaps.insert(format!(
            "provider={} capture={} file={} method={} outside locked request/response subset",
            context.provider,
            context.scenario,
            context.path.display(),
            method_name
        ));
        return Ok(());
    }
    let locked = validate_locked_request(context, bundle, envelope, method_name)?;
    if let Some(id) = envelope_id(envelope) {
        methods.insert(id, locked);
    }
    Ok(())
}

fn validate_protocol_event_response(
    context: ValidationContext<'_, '_>,
    bundle: &acp_contracts::ContractBundle,
    envelope: &Value,
    methods: &BTreeMap<String, LockedMethod>,
) -> ValidationResult<()> {
    let Some(id) = envelope_id(envelope) else {
        return Ok(());
    };
    let Some(method) = methods.get(&id).copied() else {
        return Ok(());
    };
    validate_locked_response(context, bundle, method, envelope)
}

fn validate_event_payload_matches_json(
    context: ValidationContext<'_, '_>,
    event: &Value,
    envelope: &Value,
) -> ValidationResult<()> {
    let Some(payload) = event.get("payload").and_then(Value::as_str) else {
        return Ok(());
    };
    let payload_json = serde_json::from_str::<Value>(payload)
        .map_err(|error| failure(context, format!("event payload is not valid JSON: {error}")))?;
    if payload_json != *envelope {
        return Err(failure(
            context,
            "event payload JSON does not match json field",
        ));
    }
    Ok(())
}

fn validate_locked_request(
    context: ValidationContext<'_, '_>,
    bundle: &acp_contracts::ContractBundle,
    envelope: &Value,
    method_name: &str,
) -> ValidationResult<LockedMethod> {
    if method_name == "session/cancel" {
        validate_locked_cancel_notification(bundle, envelope).map_err(|error| {
            failure(
                context,
                format!("contract drift for method {method_name}: {error}"),
            )
        })?;
        return Ok(LockedMethod::SessionCancel);
    }
    locked_request_method(bundle, envelope, method_name)
        .map_err(|message| failure(context, message))
}

fn locked_request_method(
    bundle: &acp_contracts::ContractBundle,
    envelope: &Value,
    method_name: &str,
) -> ValidationResult<LockedMethod> {
    validate_locked_request_envelope(bundle, envelope)
        .map_err(|error| format!("contract drift for method {method_name}: {error}"))
}

fn validate_locked_response(
    context: ValidationContext<'_, '_>,
    bundle: &acp_contracts::ContractBundle,
    method: LockedMethod,
    envelope: &Value,
) -> ValidationResult<()> {
    if method == LockedMethod::SessionCancel {
        return Ok(());
    }
    validate_locked_response_envelope(bundle, method, envelope).map_err(|error| {
        failure(
            context,
            format!(
                "contract drift for method {}: {error}",
                method.method_name()
            ),
        )
    })
}

fn protocol_capture_stems(provider: &str, protocol_root: &Path) -> ValidationResult<Vec<String>> {
    let mut stems = Vec::new();
    for path in sorted_files(protocol_root, provider, "<protocol>")? {
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if let Some(stem) = name.strip_suffix(".requests.jsonl") {
            stems.push(stem.to_owned());
        }
    }
    if stems.is_empty() {
        return Err(failure(
            ValidationContext {
                provider,
                scenario: "<protocol>",
                path: protocol_root,
            },
            "no protocol request captures found",
        ));
    }
    Ok(stems)
}
