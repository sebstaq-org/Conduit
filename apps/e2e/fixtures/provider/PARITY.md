# Provider Fixture Parity

This directory contains curated provider fixtures sourced from real ACP captures.
Raw captures stay outside the repository under `conduit-artifacts/manual/captures`.

## Claude

| Operation                   | Fixture | E2E         | Source                                                                                                      | Notes                                                                               |
| --------------------------- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `initialize`                | yes     | indirect    | `conduit-artifacts/manual/captures/claude/initialize/cli-parity-20260418T233644Z`                           | Live initialize capture.                                                            |
| `session/new`               | yes     | yes         | `conduit-artifacts/manual/captures/claude/parity-full-20260419T103627Z/session-prompt-model-haiku-with-new` | Extracted from real prompt capture; session id normalized.                          |
| `session/list`              | yes     | no          | `conduit-artifacts/manual/captures/claude/parity-20260418T235022Z/session-list`                             | Real provider returned an empty list for the parity workspace.                      |
| `session/set_config_option` | yes     | yes         | `conduit-artifacts/manual/captures/claude/parity-full-20260419T103627Z/session-prompt-model-haiku-with-new` | Extracted real `model=haiku` prelude; prompt fixture requires this config.          |
| `session/load`              | yes     | replay only | `conduit-artifacts/manual/captures/claude/parity-full-20260419T103627Z/session-load-after-config-prompt`    | Load succeeds and returns transcript history; Claude reports default model on load. |
| `session/prompt`            | yes     | yes         | `conduit-artifacts/manual/captures/claude/parity-full-20260419T103627Z/session-prompt-model-haiku-with-new` | Real response contains `CONDUIT_E2E_PROVIDER_PARITY_RESPONSE`.                      |

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
