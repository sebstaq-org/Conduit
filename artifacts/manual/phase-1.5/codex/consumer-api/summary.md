# Phase 1.5 Consumer API Proof (superseded by ws-live-proof): codex

Superseded note: this artifact predates the SDK-first WebSocket live proof in `artifacts/manual/phase-1.5/ws-live-proof/`. Keep it as historical Phase 1.5 output; use ws-live-proof for current acceptance.

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> snapshot/get -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `019d79cb-478f-7ec2-b9fb-f07adc3a9335`.

Consumer responses captured: `12`.

Runtime events captured: `39`.

Provider caveats:

Codex `session/load` is exercised only after the seeded session has a materialized prompt turn.

`session/cancel` is recorded as a provider notification request and no provider-independent final cancel state is asserted.
