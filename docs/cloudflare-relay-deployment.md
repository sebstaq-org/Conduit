# Cloudflare Relay Deployment

PR 2 requires a real personal Cloudflare Workers endpoint before acceptance. The local relay runtime is only a deterministic test harness; it is not a supported deployment target.

## Free Plan Guardrails

Use the Workers Free plan with SQLite-backed Durable Objects only. Do not enable Workers Paid, paid overage, KV, R2, Queues, D1, Logpush, custom domains, or dashboard-managed worker config for this relay.

The relay is intentionally dumb. It accepts WebSockets, checks opaque route capabilities from `Sec-WebSocket-Protocol`, tracks role and `connectionId`, buffers short client-before-daemon data, forwards opaque frames, and never logs payload bodies or capabilities.

## Deploy

Authenticate once:

```bash
pnpm dlx wrangler@4.83.0 login
```

Deploy from the repo-owned config:

```bash
pnpm run relay:deploy
```

Wrangler must report a `workers.dev` URL for the `conduit-relay` Worker, for example:

```text
https://conduit-relay.<account-subdomain>.workers.dev
```

## Required Verification

Run deterministic local E2E:

```bash
pnpm run relay:test:e2e
```

Run live E2E against the deployed Cloudflare endpoint:

```bash
CONDUIT_RELAY_LIVE_ENDPOINT=https://conduit-relay.<account-subdomain>.workers.dev pnpm run relay:test:live
```

PR 2 is not done until both commands pass and the PR summary includes the real endpoint that was verified. The live test must cover health, control socket notification, client-before-daemon buffering, encrypted roundtrip, reconnect, peer-observed ciphertext before decrypt, and adversarial rejection for fake control, fake data, duplicate client, and query-param-only capabilities.
