# Phase 1.5 Consumer API Proof (superseded by ws-live-proof): claude

Superseded note: this artifact predates the SDK-first WebSocket live proof in `artifacts/manual/phase-1.5/ws-live-proof/`. Keep it as historical Phase 1.5 output; use ws-live-proof for current acceptance.

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> snapshot/get -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `7de15901-9be9-45c6-b89f-149353ec8a80`.

Consumer responses captured: `12`.

Runtime events captured: `36`.

Provider caveats:

Claude replay during `session/load` is preserved in raw runtime events and is not filtered.

`session/cancel` is recorded as a provider notification request and no provider-independent final cancel state is asserted.
