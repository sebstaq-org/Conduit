# Phase 1.5 Consumer API Proof (superseded by ws-live-proof): copilot

Superseded note: this artifact predates the SDK-first WebSocket live proof in `artifacts/manual/phase-1.5/ws-live-proof/`. Keep it as historical Phase 1.5 output; use ws-live-proof for current acceptance.

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> snapshot/get -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `5e7bc382-6592-457b-bceb-a766890c6391`.

Consumer responses captured: `12`.

Runtime events captured: `37`.

Provider caveats:

Copilot `session/load` is exercised after `provider/disconnect` with a fresh `ServiceRuntime` connection.

`session/cancel` is recorded as a provider notification request and no provider-independent final cancel state is asserted.
