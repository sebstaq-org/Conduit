# Phase 1.5 Consumer API Proof: copilot

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> snapshot/get -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `5e7bc382-6592-457b-bceb-a766890c6391`.

Consumer responses captured: `12`.

Runtime events captured: `37`.

Provider caveats:

Copilot `session/load` is exercised after `provider/disconnect` with a fresh `ServiceRuntime` connection.

`session/cancel` is recorded as a raw ACP notification and no provider-independent final cancel state is asserted.
