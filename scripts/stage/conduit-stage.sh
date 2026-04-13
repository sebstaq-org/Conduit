#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
STAGE_ROOT="${CONDUIT_STAGE_ROOT:-/srv/devops/repos/conduit-stage}"
RELEASES_DIR="$STAGE_ROOT/releases"
CURRENT_LINK="$STAGE_ROOT/current"
BUILD_DIR="$STAGE_ROOT/.build"
BACKEND_HOST="${CONDUIT_STAGE_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${CONDUIT_STAGE_BACKEND_PORT:-4274}"
WEB_HOST="${CONDUIT_STAGE_WEB_HOST:-127.0.0.1}"
WEB_PORT="${CONDUIT_STAGE_WEB_PORT:-4310}"
WS_URL="${CONDUIT_STAGE_WS_URL:-ws://${BACKEND_HOST}:${BACKEND_PORT}/api/session}"
DATA_ROOT="$STAGE_ROOT/data"
PID_DIR="$STAGE_ROOT/pids"
LOG_DIR="$STAGE_ROOT/logs"
RUNNER_PATH="$STAGE_ROOT/conduit-stage"
SUPERVISOR_PID_FILE="$PID_DIR/supervisor.pid"
RUNTIME_STATUS_FILE="$PID_DIR/runtime-status.json"

run() {
  if command -v rtk >/dev/null 2>&1; then
    rtk "$@"
    return
  fi
  "$@"
}

ensure_stage_dirs() {
  run mkdir -p "$STAGE_ROOT"
  run mkdir -p "$RELEASES_DIR"
  run mkdir -p "$BUILD_DIR"
  run mkdir -p "$DATA_ROOT"
  run mkdir -p "$PID_DIR"
  run mkdir -p "$LOG_DIR"
}

release_dir() {
  if [[ ! -L "$CURRENT_LINK" ]]; then
    return 1
  fi
  readlink -f "$CURRENT_LINK"
}

pid_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" >/dev/null 2>&1
}

wait_for_runtime_ready() {
  local backend_url="http://${BACKEND_HOST}:${BACKEND_PORT}/health"
  local web_url="http://${WEB_HOST}:${WEB_PORT}/"
  local attempts=30
  local index=0
  while [[ "$index" -lt "$attempts" ]]; do
    if curl --silent --show-error --fail --max-time 2 "$backend_url" >/dev/null 2>&1 &&
      curl --silent --show-error --fail --max-time 2 "$web_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    index=$((index + 1))
  done
  return 1
}

write_stage_runner() {
  cat >"$RUNNER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
STAGE_ROOT="${STAGE_ROOT}"
REPO_SCRIPT="${REPO_ROOT}/scripts/stage/conduit-stage.sh"
if [[ "\${1:-}" == "refresh" ]]; then
  exec "\$REPO_SCRIPT" refresh
fi
exec "\$REPO_SCRIPT" "\$@"
EOF
  chmod +x "$RUNNER_PATH"
}

seed_worklets_cache() {
  local source_root="$1"
  local target_root="$2"
  local source_pkg
  local target_pkg
  source_pkg="$(find "$source_root/node_modules/.pnpm" -maxdepth 1 -type d -name "react-native-worklets@*" | head -n 1)"
  target_pkg="$(find "$target_root/node_modules/.pnpm" -maxdepth 1 -type d -name "react-native-worklets@*" | head -n 1)"

  if [[ -z "$source_pkg" || -z "$target_pkg" ]]; then
    return
  fi

  local source_worklets="$source_pkg/node_modules/react-native-worklets/.worklets"
  local target_worklets="$target_pkg/node_modules/react-native-worklets/.worklets"
  if [[ ! -d "$source_worklets" || ! -d "$target_worklets" ]]; then
    return
  fi

  local source_resolved
  local target_resolved
  source_resolved="$(readlink -f "$source_worklets")"
  target_resolved="$(readlink -f "$target_worklets")"
  if [[ "$source_resolved" == "$target_resolved" ]]; then
    return
  fi

  (
    cd "$source_worklets"
    tar -cf - .
  ) | (
    cd "$target_worklets"
    tar -xf -
  )
}

install_desktop_entry() {
  local applications_dir
  applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  local desktop_file="$applications_dir/conduit-stage.desktop"
  run mkdir -p "$applications_dir"
  cat >"$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Conduit Stage
Comment=Run isolated Conduit stage build
Exec=${RUNNER_PATH} open
Terminal=false
Icon=utilities-terminal
Categories=Development;
EOF
  printf "Desktop entry installed: %s\n" "$desktop_file"
}

refresh_stage() {
  ensure_stage_dirs
  run git -C "$REPO_ROOT" fetch origin
  local commit
  commit="$(run git -C "$REPO_ROOT" rev-parse --verify origin/main)"
  local short_commit
  short_commit="$(printf "%s" "$commit" | cut -c1-12)"
  local timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local release_name="${timestamp}-${short_commit}"
  local scratch_dir="$BUILD_DIR/$release_name"
  local source_dir="$scratch_dir/source"
  local release_dir="$RELEASES_DIR/$release_name"

  run rm -rf "$scratch_dir"
  run mkdir -p "$source_dir"
  run mkdir -p "$release_dir/bin"
  run mkdir -p "$release_dir/meta"

  run git -C "$REPO_ROOT" archive --format=tar "$commit" | tar -x -f - -C "$source_dir"

  (
    cd "$source_dir"
    export EXPO_PUBLIC_CONDUIT_SESSION_WS_URL="$WS_URL"
    run pnpm install --frozen-lockfile
    run pnpm run build
    seed_worklets_cache "$REPO_ROOT" "$source_dir"
    run pnpm --filter @conduit/frontend exec expo export --platform web --output-dir "$release_dir/web"
    run cargo build --manifest-path backend/service/Cargo.toml -p service-bin --release
  )

  run cp "$source_dir/backend/service/target/release/service-bin" "$release_dir/bin/service-bin"
  chmod +x "$release_dir/bin/service-bin"
  cat >"$release_dir/meta/build.json" <<EOF
{
  "commit": "$commit",
  "createdAt": "$timestamp",
  "backendHost": "$BACKEND_HOST",
  "backendPort": $BACKEND_PORT,
  "webHost": "$WEB_HOST",
  "webPort": $WEB_PORT,
  "websocketUrl": "$WS_URL"
}
EOF

  ln -sfn "$release_dir" "$CURRENT_LINK"
  write_stage_runner
  if pid_running "$SUPERVISOR_PID_FILE" || pid_running "$PID_DIR/backend.pid" || pid_running "$PID_DIR/web.pid"; then
    stop_stage
    start_stage
  fi
  printf "Stage refreshed to %s\n" "$release_name"
}

start_stage() {
  ensure_stage_dirs
  local current_release
  current_release="$(release_dir)" || {
    printf "No stage release found. Run: %s refresh\n" "$0" >&2
    exit 1
  }

  if ! pid_running "$SUPERVISOR_PID_FILE"; then
    setsid python3 "$SCRIPT_DIR/watchdog.py" \
      --backend-host "$BACKEND_HOST" \
      --backend-port "$BACKEND_PORT" \
      --current-link "$CURRENT_LINK" \
      --data-root "$DATA_ROOT" \
      --log-dir "$LOG_DIR" \
      --pid-dir "$PID_DIR" \
      --poll-interval 5 \
      --status-file "$RUNTIME_STATUS_FILE" \
      --static-server "$SCRIPT_DIR/static_server.py" \
      --web-host "$WEB_HOST" \
      --web-port "$WEB_PORT" >"$LOG_DIR/supervisor.log" 2>&1 < /dev/null &
    printf "%s" "$!" >"$SUPERVISOR_PID_FILE"
    sleep 0.2
    if ! pid_running "$SUPERVISOR_PID_FILE"; then
      printf "Supervisor failed to start. See %s/supervisor.log\n" "$LOG_DIR" >&2
      exit 1
    fi
  fi

  if ! wait_for_runtime_ready; then
    printf "Stage runtime failed readiness checks. See %s\n" "$RUNTIME_STATUS_FILE" >&2
    exit 1
  fi

  printf "Backend: ws://%s:%s/api/session\n" "$BACKEND_HOST" "$BACKEND_PORT"
  printf "Web: http://%s:%s\n" "$WEB_HOST" "$WEB_PORT"
}

stop_stage() {
  local pid_file
  for pid_file in "$SUPERVISOR_PID_FILE" "$PID_DIR/backend.pid" "$PID_DIR/web.pid"; do
    if pid_running "$pid_file"; then
      local pid
      pid="$(cat "$pid_file")"
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  done
}

status_stage() {
  local current_release
  if current_release="$(release_dir)"; then
    printf "Release: %s\n" "$current_release"
  else
    printf "Release: none\n"
  fi

  if pid_running "$SUPERVISOR_PID_FILE"; then
    printf "Supervisor: running (pid %s)\n" "$(cat "$SUPERVISOR_PID_FILE")"
  else
    printf "Supervisor: stopped\n"
  fi

  if pid_running "$PID_DIR/backend.pid"; then
    printf "Backend: running (pid %s)\n" "$(cat "$PID_DIR/backend.pid")"
  else
    printf "Backend: stopped\n"
  fi

  if pid_running "$PID_DIR/web.pid"; then
    printf "Web: running (pid %s)\n" "$(cat "$PID_DIR/web.pid")"
  else
    printf "Web: stopped\n"
  fi

  if [[ -f "$RUNTIME_STATUS_FILE" ]]; then
    printf "Runtime status: %s\n" "$RUNTIME_STATUS_FILE"
    cat "$RUNTIME_STATUS_FILE"
  else
    printf "Runtime status: unavailable\n"
  fi
}

open_stage() {
  start_stage
  local url="http://${WEB_HOST}:${WEB_PORT}/?v=$(date +%s)"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
    return
  fi
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 &
    return
  fi
  printf "Open this URL: %s\n" "$url"
}

show_logs() {
  local stream="${1:-all}"
  case "$stream" in
    backend)
      tail -n 200 "$LOG_DIR/backend.log"
      ;;
    web)
      tail -n 200 "$LOG_DIR/web.log"
      ;;
    supervisor)
      tail -n 200 "$LOG_DIR/supervisor.log"
      ;;
    all)
      printf "Backend log: %s/backend.log\n" "$LOG_DIR"
      printf "Web log: %s/web.log\n" "$LOG_DIR"
      printf "Supervisor log: %s/supervisor.log\n" "$LOG_DIR"
      ;;
    *)
      printf "Unknown log stream: %s\n" "$stream" >&2
      exit 1
      ;;
  esac
}

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  refresh               Build latest origin/main into a tagged stage release
  start                 Start stage supervisor and wait for runtime readiness
  stop                  Stop stage supervisor, backend, and web server
  status                Show current release and process status
  open                  Start stage if needed and open browser
  logs [backend|web|supervisor] Show recent log output
  install-desktop-entry Install a desktop launcher for stage open
EOF
}

command="${1:-}"
case "$command" in
  refresh)
    refresh_stage
    ;;
  start)
    start_stage
    ;;
  stop)
    stop_stage
    ;;
  status)
    status_stage
    ;;
  open)
    open_stage
    ;;
  logs)
    show_logs "${2:-all}"
    ;;
  install-desktop-entry)
    ensure_stage_dirs
    write_stage_runner
    install_desktop_entry
    ;;
  *)
    usage
    exit 1
    ;;
esac
