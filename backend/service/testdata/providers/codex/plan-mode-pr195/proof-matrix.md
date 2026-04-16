# Codex ACP PR195 Proof Matrix (Canonical)

Canonical source for A-gate (Codex ACP scope) is `proof-index.json` in this
directory. This table is the human-readable view of the same row ids.

| Row ID                                         | Status     | Source Run(s)         | Decision                                                                            |
| ---------------------------------------------- | ---------- | --------------------- | ----------------------------------------------------------------------------------- |
| `patched_adapter_runtime_identity`             | `verified` | `RUN_DIRECT`          | Proof runs use patched adapter binary.                                              |
| `collaboration_mode_config_option_exposed`     | `verified` | `RUN_DIRECT`          | Plan mode is exposed via `configOptions.collaboration_mode`.                        |
| `session_set_mode_plan_invalid_params`         | `verified` | `RUN_EDGECASES_FINAL` | `session/set_mode` is not the Codex activation lane.                                |
| `session_set_config_option_plan_direct`        | `verified` | `RUN_DIRECT`          | `session/set_config_option(collaboration_mode=plan)` works in direct ACP lane.      |
| `session_set_config_option_plan_conduit_error` | `verified` | `RUN_CONDUIT`         | Conduit-hosted lane currently surfaces provider error for set-config path.          |
| `structured_question_carrier`                  | `verified` | `RUN_DIRECT`          | Structured questions arrive via `session/request_permission`.                       |
| `question_payload_shape_and_options`           | `verified` | `RUN_DIRECT`          | Question and option payload shape is stable for normalization.                      |
| `question_answer_correlation_and_sequence`     | `verified` | `RUN_DIRECT`          | Sequential multi-question flow correlates by JSON-RPC id.                           |
| `selected_answer_payload`                      | `verified` | `RUN_DIRECT`          | Selected-option response payload is verified.                                       |
| `answer_other_payload_with_meta`               | `verified` | `RUN_EDGECASES_FINAL` | Free-text `answer-other` payload uses `selected._meta.request_user_input_response`. |
| `cancel_pending_question_behavior`             | `verified` | `RUN_EDGECASES_FINAL` | Cancel under pending question yields failed tool_call_update + cancelled turn.      |
| `invalid_option_behavior`                      | `verified` | `RUN_EDGECASES_FINAL` | Invalid option yields same failed/cancelled outcome path.                           |
| `continuation_after_plan_and_session_load`     | `verified` | `RUN_DIRECT`          | Continuation after `session/load` works with same session id.                       |
| `prompt_lane_supports_mid_turn_answers`        | `verified` | `RUN_DIRECT`          | Mid-turn out-of-band answer lane is verified.                                       |
| `typed_terminal_plan_signal`                   | `missing`  | `RUN_DIRECT`          | No typed plan terminal signal in wire; use product rule for completion.             |
| `explicit_implement_plan_action`               | `missing`  | `RUN_EDGECASES_FINAL` | No explicit implement-plan action in observed command surfaces.                     |

## Codex A-Gate verdict

- Decision completeness: no `partial` or `blocked` rows.
- Missing rows include explicit proof-of-absence commands in `proof-index.json`.
- Codex ACP scope for A is complete; Paseo parity is handled as separate follow-up scope.
