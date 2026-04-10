# Phase 1.5 Consumer API Proof: claude

Consumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> provider/snapshot -> events/subscribe -> provider/disconnect`.

Seeded ACP session id: `831b781d-cbf3-421c-bc5a-c81c1e8b2be0`.

Consumer responses captured: `12`.

Runtime events captured: `36`.

Provider caveats:

Claude replay during `session/load` is preserved in raw runtime events and is not filtered.

`session/cancel` is recorded as a raw ACP notification and no provider-independent final cancel state is asserted.
