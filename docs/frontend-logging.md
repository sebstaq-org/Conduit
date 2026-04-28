# Frontend Logging

Conduit frontend code logs through `apps/frontend/src/app-state/frontend-logger.ts`.
Call sites must not write directly to Sentry, `/api/client-log`, or console logging
helpers. The logger creates one redacted `FrontendLogRecord` and fans it out to the
configured sinks.

The Sentry sink is enabled when `EXPO_PUBLIC_SENTRY_DSN` is present. Native and web
builds use the same DSN variable, `EXPO_PUBLIC_CONDUIT_LOG_PROFILE` as the Sentry
environment, and the Sentry wizard's Expo plugin configured for org `sebstaq` and
project `conduit`. `SENTRY_AUTH_TOKEN` is build-only for sourcemap upload and must
never be committed.

The Sentry sink sends each frontend record through Sentry Structured Logs and keeps
the same record as a breadcrumb. Error records also create Sentry events with the
redacted record attached as context.

Run builds through Doppler so `EXPO_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`
come from the `conduit` project/config instead of local files. The Sentry wizard
may create `.env.local` or `android/sentry.properties` for local testing; those
files must stay uncommitted.

The file sink is enabled when `EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL` is present, or
when `EXPO_PUBLIC_CONDUIT_SESSION_WS_URL` can be mapped to `/api/client-log`. This
keeps desktop local log files as another sink behind the same logger path.

The logger redacts prompt/content/input/text fields, bearer-style credentials,
route capabilities, tokens, secrets, cookies, private keys, and pairing offer URLs
before any sink receives a record.

Runtime tags are explicit. Electron sets `desktop_app/electron` through the
desktop runtime config, React Native sets `mobile_app/native` through
`navigator.product === "ReactNative"`, and DOM web sets `web_app/web`. Unknown
non-DOM runtimes fail instead of being mislabeled.

The opt-in live proof is
`rtk doppler run --project conduit --config dev -- pnpm --filter @conduit/e2e run test:sentry-runtime-live`.
It exports the real frontend web app, opens desktop and mobile-shaped runtimes,
and queries Sentry Logs for both runtime records. The token used for
`SENTRY_AUTH_TOKEN` must have `org:read` access to query Sentry Explore Logs.
