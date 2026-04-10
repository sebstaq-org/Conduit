# Phase 1.5 Checkpoint 4: Runtime Events

This checkpoint adds consumer runtime event fanout in `service-runtime`.

`events/subscribe` now exposes consumer runtime events and raw wire events as separate arrays. Raw wire data remains debug/proof truth, while provider snapshots remain read-side state returned with command responses.

Prompt dispatch records `prompt_started`, `prompt_update_observed`, and `prompt_completed` only after the provider response completes. Cancel dispatch records `cancel_sent` only and does not invent a provider-independent cancelled/completed final state.

Verification commands:

```sh
rtk cargo test --manifest-path backend/service/Cargo.toml -p service-runtime
rtk pnpm run check
```
