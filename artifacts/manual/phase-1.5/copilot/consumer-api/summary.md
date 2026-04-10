# Phase 1.5 Consumer API Proof: copilot

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> provider/snapshot -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `e1dabc71-f8f7-4bda-9daf-4dbc02ea8cc9`.

Consumer responses captured: `12`.

Runtime events captured: `37`.

Provider caveats:

Copilot `session/load` is exercised after `provider/disconnect` with a fresh `ServiceRuntime` connection.

`session/cancel` is recorded as a raw ACP notification and no provider-independent final cancel state is asserted.
