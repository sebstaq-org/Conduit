# Provider Config State

Conduit should move provider config for new sessions into persistent backend
state. The current `providers/config_snapshot` flow is an in-memory bridge; it
must be replaced by a SQLite-backed provider config model when we take the full
redesign.

The target model is one stored record per provider containing the latest usable
`ready` config options, mode metadata, model metadata, fetch timestamp, provider
fingerprint, and latest refresh error. `loading` must not be part of the product
contract for new sessions. A refresh can be in progress, but the composer should
only receive providers with usable config.

That redesign should remove the in-memory snapshot worker and the
`providers/config_snapshot` command entirely, replacing them with one backend
owned provider config command. No migration or compatibility layer is required;
old local stores may fail fast and be recreated.
