# Stage Operations

Use `scripts/stage/conduit-stage.sh` to build and run an isolated browser stage
environment outside the repo workspace.

## Commands

- `refresh`: build tagged release from `origin/main` into
  `/srv/devops/repos/conduit-stage/releases` and repoint `current`.
- `start`: start backend and static web server for the `current` release.
- `stop`: stop stage processes.
- `status`: print release and process status.
- `open`: start stage and open browser URL.
- `logs [backend|web]`: print stage logs.
- `install-desktop-entry`: install `.desktop` launcher to run `open`.

## Default Runtime Config

- backend host/port: `127.0.0.1:4274`
- web host/port: `127.0.0.1:4310`
- ws url for stage web build: `ws://127.0.0.1:4274/api/session`
- stage root: `/srv/devops/repos/conduit-stage`

## Environment Overrides

- `CONDUIT_STAGE_ROOT`
- `CONDUIT_STAGE_BACKEND_HOST`
- `CONDUIT_STAGE_BACKEND_PORT`
- `CONDUIT_STAGE_WEB_HOST`
- `CONDUIT_STAGE_WEB_PORT`
- `CONDUIT_STAGE_WS_URL`
