# Provider Fixture Parity

This directory contains curated provider fixtures sourced from real ACP captures.
Raw captures stay outside the repository under `conduit-artifacts/manual/captures`.

## Claude

| Operation                   | Fixture | E2E         | Source                                                                                                                                                                 | Notes                                                                    |
| --------------------------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `initialize`                | yes     | indirect    | `conduit-artifacts/manual/captures/claude/initialize/cli-parity-20260418T233644Z`                                                                                      | Live initialize capture.                                                 |
| `session/new`               | yes     | yes         | `conduit-artifacts/manual/captures/claude/parity-20260418T235022Z/session-new`                                                                                         | Session id normalized to `e2e-claude-new-session-0001`.                  |
| `session/list`              | yes     | no          | `conduit-artifacts/manual/captures/claude/parity-20260418T235022Z/session-list`                                                                                        | Real provider returned an empty list for the parity workspace.           |
| `session/set_config_option` | yes     | replay only | `conduit-artifacts/manual/captures/claude/parity-attempt2-20260418T235132Z/session-set-config-option-model-haiku-with-new`                                             | Real `model=haiku`; session id normalized.                               |
| `session/load`              | no      | no          | failed attempts in `claude/parity-20260418T235022Z/session-load` and `claude/parity-attempt2-20260418T235132Z/session-load-after-config`                               | Provider returned ACP SDK errors for captured new/config sessions.       |
| `session/prompt`            | no      | no          | failed attempts in `claude/parity-attempt2-20260418T235132Z/session-prompt-with-new` and `claude/parity-attempt3-20260418T235329Z/session-prompt-with-new-model-haiku` | Provider returned ACP SDK errors, including after `model=haiku` prelude. |

## Copilot

| Operation                   | Fixture | E2E         | Source                                                                                                                | Notes                                                                                        |
| --------------------------- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `initialize`                | yes     | indirect    | `conduit-artifacts/manual/captures/copilot/initialize/cli-parity-20260418T233653Z`                                    | Local terminal-auth command path sanitized to `copilot`.                                     |
| `session/new`               | yes     | yes         | `conduit-artifacts/manual/captures/copilot/parity-config-prompt-20260418T235432Z/session-prompt-model-gpt41-with-new` | Extracted from real prompt capture; session id normalized to `e2e-copilot-new-session-0001`. |
| `session/list`              | yes     | no          | `conduit-artifacts/manual/captures/copilot/parity-20260418T235209Z/session-list`                                      | Real provider returned an empty list for the parity workspace.                               |
| `session/set_config_option` | yes     | yes         | `conduit-artifacts/manual/captures/copilot/parity-config-prompt-20260418T235432Z/session-prompt-model-gpt41-with-new` | Extracted real `model=gpt-4.1` prelude; prompt fixture requires this config.                 |
| `session/prompt`            | yes     | yes         | `conduit-artifacts/manual/captures/copilot/parity-config-prompt-20260418T235432Z/session-prompt-model-gpt41-with-new` | Real response contains `CONDUIT_E2E_PROVIDER_PARITY_RESPONSE`.                               |
| `session/load`              | yes     | replay only | `conduit-artifacts/manual/captures/copilot/parity-config-prompt-20260418T235432Z/session-load-after-config-prompt`    | Load succeeds after the real prompt materializes transcript history.                         |

## Codex

Codex remains the reference fixture set and additionally has plan-mode fixtures.
Plan mode is intentionally out of scope for Claude and Copilot parity.
