# backend/service

This Rust workspace now contains the Phase 1 official ACP-only baseline: vendored contract validation, launcher discovery, stdio JSON-RPC host runtime, app-facing provider operations, and a silent proof runner for manual artifacts.

Provider runtime endpoints remain only the official adapter binaries. Conduit does not define a provider-specific protocol or fallback runtime path.
