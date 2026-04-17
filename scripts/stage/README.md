# Stage Operations

Use `scripts/stage/conduit-stage.sh` to build and run an isolated local stage
environment outside the repo workspace. This is a fast single-user stage build:
Electron hosts the exported web app and owns the bundled Rust `service-bin`
process lifecycle.

## Commands

- `refresh`: build tagged release from `origin/main` into
  `/srv/devops/repos/conduit-stage/releases` and repoint `current`. If stage is
  already running, `refresh` restarts it onto the new release automatically.
- `start`: start Electron stage, backend, and Electron-owned web server; fail if
  readiness checks do not pass.
- `stop`: stop Electron stage and its child backend process.
- `status`: print release and process status.
- `open`: start stage.
- `logs [backend|frontend|electron|web|supervisor]`: print stage logs.
- `install-desktop-entry`: install `.desktop` launcher to run `open`.

## Default Runtime Config

- backend host/port: `127.0.0.1:4274`
- web host/port: `127.0.0.1:4310`
- ws url for stage web build: `ws://127.0.0.1:4274/api/session`
- stage root: `/srv/devops/repos/conduit-stage`
- backend tracing profile: `CONDUIT_LOG_PROFILE=stage` (default level `debug`)
- stage static server disables browser caching and returns `204` for
  `/favicon.ico` to avoid benign 404 noise.
- Electron waits for backend `/health` and web `/` before reporting readiness.
- Closing Electron sends `SIGTERM` to the child backend process.

## Environment Overrides

- `CONDUIT_STAGE_ROOT`
- `CONDUIT_STAGE_BACKEND_HOST`
- `CONDUIT_STAGE_BACKEND_PORT`
- `CONDUIT_STAGE_WEB_HOST`
- `CONDUIT_STAGE_WEB_PORT`
- `CONDUIT_STAGE_WS_URL`
