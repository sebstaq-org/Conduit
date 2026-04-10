# Phase 1.5 Consumer API Proof: codex

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> provider/snapshot -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `019d797c-92b4-7a42-933c-8615fe5e6c3e`.

Consumer responses captured: `12`.

Runtime events captured: `39`.

Provider caveats:

Codex `session/load` is exercised only after the seeded session has a materialized prompt turn.

`session/cancel` is recorded as a raw ACP notification and no provider-independent final cancel state is asserted.
