# Stage Operations

Use `scripts/stage/conduit-stage.sh` to build and run an isolated browser stage
environment outside the repo workspace.

## Commands

- `refresh`: build tagged release from `origin/main` into
  `/srv/devops/repos/conduit-stage/releases` and repoint `current`. If stage is
  already running, `refresh` restarts it onto the new release automatically.
- `start`: start stage supervisor, backend, and web; fail if readiness checks do
  not pass.
- `stop`: stop stage supervisor and child processes.
- `status`: print release and process status.
- `open`: start stage and open browser URL with a cache-busting query string.
- `logs [backend|web|supervisor]`: print stage logs.
- `install-desktop-entry`: install `.desktop` launcher to run `open`.

## Default Runtime Config

- backend host/port: `127.0.0.1:4274`
- web host/port: `127.0.0.1:4310`
- ws url for stage web build: `ws://127.0.0.1:4274/api/session`
- stage root: `/srv/devops/repos/conduit-stage`
- backend tracing profile: `CONDUIT_LOG_PROFILE=stage` (default level `debug`)
- stage static server disables browser caching and returns `204` for
  `/favicon.ico` to avoid benign 404 noise.
- supervisor health polling: every 5 seconds for backend `/health` and web `/`
- restart policy: fast backoff `1s/2s/4s`, budget `3 restarts / 60s`, then
  degraded with slow retry every `30s`

## Environment Overrides

- `CONDUIT_STAGE_ROOT`
- `CONDUIT_STAGE_BACKEND_HOST`
- `CONDUIT_STAGE_BACKEND_PORT`
- `CONDUIT_STAGE_WEB_HOST`
- `CONDUIT_STAGE_WEB_PORT`
- `CONDUIT_STAGE_WS_URL`
