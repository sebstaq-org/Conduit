use crate::Result;
use crate::error::RuntimeError;
use acp_core::InteractionResponse;
use serde_json::Value;

pub(super) fn parse_interaction_response(params: &Value) -> Result<InteractionResponse> {
    let command = "session/respond_interaction";
    let Some(response) = params.get("response") else {
        return Err(RuntimeError::MissingParameter {
            command,
            parameter: "response",
        });
    };
    let Some(kind) = response.get("kind").and_then(Value::as_str) else {
        return Err(RuntimeError::InvalidParameter {
            command,
            parameter: "response.kind",
            message: "must be selected, answer_other, or cancel",
        });
    };
    match kind {
        "selected" => selected_response(response),
        "answer_other" => answer_other_response(response),
        "cancel" => Ok(InteractionResponse::Cancelled),
        _ => Err(RuntimeError::InvalidParameter {
            command,
            parameter: "response.kind",
            message: "must be selected, answer_other, or cancel",
        }),
    }
}

fn selected_response(response: &Value) -> Result<InteractionResponse> {
    let option_id =
        response
            .get("optionId")
            .and_then(Value::as_str)
            .ok_or(RuntimeError::InvalidParameter {
                command: "session/respond_interaction",
                parameter: "response.optionId",
                message: "selected response requires optionId",
            })?;
    Ok(InteractionResponse::Selected {
        option_id: option_id.to_owned(),
    })
}

fn answer_other_response(response: &Value) -> Result<InteractionResponse> {
    let question_id = response.get("questionId").and_then(Value::as_str).ok_or(
        RuntimeError::InvalidParameter {
            command: "session/respond_interaction",
            parameter: "response.questionId",
            message: "answer_other response requires questionId",
        },
    )?;
    let text =
        response
            .get("text")
            .and_then(Value::as_str)
            .ok_or(RuntimeError::InvalidParameter {
                command: "session/respond_interaction",
                parameter: "response.text",
                message: "answer_other response requires text",
            })?;
    let option_id = response
        .get("optionId")
        .and_then(Value::as_str)
        .unwrap_or("answer-other");
    Ok(InteractionResponse::AnswerOther {
        option_id: option_id.to_owned(),
        question_id: question_id.to_owned(),
        text: text.to_owned(),
    })
}
