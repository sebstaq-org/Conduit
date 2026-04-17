# Stage Operations

Use `scripts/stage/conduit-stage.sh` to build, install, and run an isolated
local stage outside the repo workspace. Stage is a versioned tarball containing
a Forge-packaged Electron app, exported web assets, and the release-built Rust
`service-bin`; Electron owns the Rust process lifecycle at runtime.

## Commands

- `build-artifact`: build selected ref into
  `/srv/devops/repos/conduit-stage/artifacts/conduit-stage-*-linux-x64.tar.gz`.
- `install-artifact PATH`: install a tarball into `releases` and repoint
  `current`.
- `deploy` / `refresh`: build an artifact, install it, stop old stage, and start
  the new packaged app.
- `start`: start packaged Electron stage, backend, and Electron-owned web
  server; fail if readiness checks do not pass.
- `stop`: stop Electron stage and its child backend process.
- `status`: print release and process status.
- `open`: start stage.
- `logs [backend|frontend|electron|web]`: print stage logs.
- `install-desktop-entry`: install `.desktop` launcher to run `open`.

## Default Runtime Config

- backend host/port: `127.0.0.1:4274`
- web host/port: `127.0.0.1:4310`
- ws url for stage web build: `ws://127.0.0.1:4274/api/session`
- stage root: `/srv/devops/repos/conduit-stage`
- backend tracing profile: `CONDUIT_LOG_PROFILE=stage` (default level `debug`)
- stage static server injects `globalThis.CONDUIT_RUNTIME_CONFIG` into HTML
  instead of mutating `process.env` at browser runtime.
- Electron waits for backend `/health` and web `/` before reporting readiness.
- Closing Electron sends `SIGTERM` to the child backend process and escalates to
  `SIGKILL` if the backend does not exit.

## Environment Overrides

- `CONDUIT_STAGE_ROOT`
- `CONDUIT_STAGE_BACKEND_HOST`
- `CONDUIT_STAGE_BACKEND_PORT`
- `CONDUIT_STAGE_WEB_HOST`
- `CONDUIT_STAGE_WEB_PORT`
- `CONDUIT_STAGE_WS_URL`
- `CONDUIT_STAGE_CLIENT_LOG_URL`
