# backend/service

This Rust workspace implements Conduit's official-ACP-only backend surface: vendored contract validation, launcher discovery, stdio JSON-RPC host runtime, `service-runtime` consumer dispatch, and a versioned WebSocket product boundary in `service-bin serve`.

Provider runtime endpoints remain only the official adapter binaries. Conduit does not define a provider-specific protocol or fallback runtime path.

Normal consumers use `ws://127.0.0.1:4174/api/session` with frames shaped as `{ "v": 1, "type": "command", "id": "...", "command": ... }`; responses echo the same `id`, and runtime events are emitted as `{ "v": 1, "type": "event", "event": ... }`.
