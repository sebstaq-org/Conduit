#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
STAGE_ROOT="${CONDUIT_STAGE_ROOT:-/srv/devops/repos/conduit-stage}"
RELEASES_DIR="$STAGE_ROOT/releases"
ARTIFACTS_DIR="$STAGE_ROOT/artifacts"
CURRENT_LINK="$STAGE_ROOT/current"
BUILD_DIR="$STAGE_ROOT/.build"
BACKEND_HOST="${CONDUIT_STAGE_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${CONDUIT_STAGE_BACKEND_PORT:-4274}"
WS_URL="${CONDUIT_STAGE_WS_URL:-ws://${BACKEND_HOST}:${BACKEND_PORT}/api/session}"
CLIENT_LOG_URL="${CONDUIT_STAGE_CLIENT_LOG_URL:-http://${BACKEND_HOST}:${BACKEND_PORT}/api/client-log}"
RELAY_ENDPOINT="${CONDUIT_STAGE_RELAY_ENDPOINT:-${CONDUIT_RELAY_ENDPOINT:-}}"
APP_BASE_URL="${CONDUIT_STAGE_APP_BASE_URL:-conduit://pair}"
BUILD_REF="${CONDUIT_STAGE_BUILD_REF:-HEAD}"
DATA_ROOT="$STAGE_ROOT/data"
PID_DIR="$STAGE_ROOT/pids"
LOG_DIR="$STAGE_ROOT/logs"
BACKEND_LOG_BASE_PATH="$DATA_ROOT/logs/backend.log"
FRONTEND_LOG_PATH="$LOG_DIR/frontend.log"
RUNNER_PATH="$STAGE_ROOT/conduit-stage"
ELECTRON_PID_FILE="$PID_DIR/electron.pid"
BACKEND_PID_FILE="$PID_DIR/backend.pid"

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
  run mkdir -p "$ARTIFACTS_DIR"
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

wait_for_pid_exit() {
  local pid="$1"
  local attempts=50
  local index=0
  while [[ "$index" -lt "$attempts" ]]; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
    index=$((index + 1))
  done
}

wait_for_runtime_ready() {
  local backend_url="http://${BACKEND_HOST}:${BACKEND_PORT}/health"
  local attempts=60
  local index=0
  while [[ "$index" -lt "$attempts" ]]; do
    if curl --silent --show-error --fail --max-time 2 "$backend_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    index=$((index + 1))
  done
  return 1
}

json_field() {
  local file_path="$1"
  local expression="$2"
  node - "$file_path" "$expression" <<'EOF'
const fs = require("node:fs");

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const value = process.argv[3]
  .split(".")
  .reduce((current, key) => current?.[key], data);

if (value === undefined || value === null) {
  process.exit(2);
}

process.stdout.write(String(value));
EOF
}

write_stage_runner() {
  cat >"$RUNNER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
REPO_SCRIPT="${REPO_ROOT}/scripts/stage/conduit-stage.sh"
case "\${1:-open}" in
  refresh)
    exec "\$REPO_SCRIPT" refresh
    ;;
  *)
    exec "\$REPO_SCRIPT" "\$@"
    ;;
esac
EOF
  chmod +x "$RUNNER_PATH"
}

write_github_output() {
  local name="$1"
  local value="$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf "%s=%s\n" "$name" "$value" >>"$GITHUB_OUTPUT"
  fi
}

build_artifact() {
  ensure_stage_dirs
  local commit
  commit="$(run git -C "$REPO_ROOT" rev-parse --verify "$BUILD_REF")"
  local short_commit
  short_commit="$(printf "%s" "$commit" | cut -c1-12)"
  local timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local release_name="${timestamp}-${short_commit}"
  local scratch_dir="$BUILD_DIR/$release_name"
  local source_dir="$scratch_dir/source"
  local resources_dir="$scratch_dir/stage-resources"
  local stage_vendor_dir="$resources_dir/vendor/agent-client-protocol"
  local forge_out_dir="$scratch_dir/forge"
  local bundle_root="$scratch_dir/bundle"
  local bundle_dir="$bundle_root/$release_name"
  local artifact_name="conduit-stage-${release_name}-linux-x64.tar.gz"
  local artifact_path="$ARTIFACTS_DIR/$artifact_name"

  run rm -rf "$scratch_dir"
  run mkdir -p "$source_dir"
  run mkdir -p "$resources_dir/bin"
  run mkdir -p "$(dirname "$stage_vendor_dir")"
  run mkdir -p "$bundle_dir"

  run git -C "$REPO_ROOT" archive --format=tar "$commit" | tar -x -f - -C "$source_dir"

  (
    cd "$source_dir"
    export EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL="$CLIENT_LOG_URL"
    export EXPO_PUBLIC_CONDUIT_LOG_PROFILE="stage"
    export EXPO_PUBLIC_CONDUIT_SESSION_WS_URL="$WS_URL"
    export CONDUIT_STAGE_PACKAGE_OUT_DIR="$forge_out_dir"
    export CONDUIT_STAGE_RESOURCES_DIR="$resources_dir"
    run pnpm install --frozen-lockfile
    run pnpm run build
    run pnpm --filter @conduit/desktop run build
    run pnpm --filter @conduit/frontend exec expo export --clear --platform web --output-dir "$resources_dir/web"
    run bash scripts/codex-acp-vendor.sh build
    run cargo build --manifest-path backend/service/Cargo.toml -p service-bin --release
    local service_bin_path
    service_bin_path="$(
      run cargo metadata --manifest-path backend/service/Cargo.toml --format-version 1 --no-deps |
        node -e 'const fs = require("node:fs"); const metadata = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(`${metadata.target_directory}/release/service-bin`);'
    )"
    run cp "$service_bin_path" "$resources_dir/bin/service-bin"
    run cp .conduit/bin/codex-acp "$resources_dir/bin/codex-acp"
    run cp -a vendor/agent-client-protocol "$stage_vendor_dir"
    chmod +x "$resources_dir/bin/service-bin"
    chmod +x "$resources_dir/bin/codex-acp"
    write_manifest "$resources_dir/manifest.json" "$commit" "$timestamp"
    run pnpm --filter @conduit/desktop run package:stage
  )

  local package_dir
  package_dir="$(find "$forge_out_dir" -maxdepth 1 -type d -name "*-linux-x64" | head -n 1)"
  if [[ -z "$package_dir" ]]; then
    printf "No Forge linux x64 package found in %s\n" "$forge_out_dir" >&2
    exit 1
  fi

  run cp -a "$package_dir" "$bundle_dir/app"
  run cp "$resources_dir/manifest.json" "$bundle_dir/manifest.json"
  validate_release_dir "$bundle_dir"
  run tar -C "$bundle_root" -czf "$artifact_path" "$release_name"
  printf "Stage artifact built: %s\n" "$artifact_path"
  write_github_output "artifact_path" "$artifact_path"
  write_github_output "artifact_name" "$artifact_name"
}

write_manifest() {
  local manifest_path="$1"
  local commit="$2"
  local timestamp="$3"
  cat >"$manifest_path" <<EOF
{
  "commit": "$commit",
  "buildRef": "$BUILD_REF",
  "createdAt": "$timestamp",
  "platform": "linux",
  "arch": "x64",
  "backendHost": "$BACKEND_HOST",
  "backendPort": $BACKEND_PORT,
  "websocketUrl": "$WS_URL"
}
EOF
}

validate_release_dir() {
  local release_dir="$1"
  if [[ ! -f "$release_dir/manifest.json" ]]; then
    printf "Stage release is missing manifest.json\n" >&2
    exit 1
  fi
  local executable
  executable="$(stage_executable_for_release "$release_dir")"
  if [[ -z "$executable" || ! -x "$executable" ]]; then
    printf "Stage release is missing executable app/conduit-stage\n" >&2
    exit 1
  fi
  if [[ ! -f "$release_dir/app/resources/stage-resources/vendor/agent-client-protocol/manifest.toml" ]]; then
    printf "Stage release is missing ACP vendor manifest\n" >&2
    exit 1
  fi
  if [[ ! -x "$release_dir/app/resources/stage-resources/bin/codex-acp" ]]; then
    printf "Stage release is missing codex-acp adapter binary\n" >&2
    exit 1
  fi
  if [[ ! -f "$release_dir/app/resources/stage-resources/web/index.html" ]]; then
    printf "Stage release is missing frontend web assets\n" >&2
    exit 1
  fi
}

stage_executable_for_release() {
  local release_dir="$1"
  local executable="$release_dir/app/conduit-stage"
  if [[ -x "$executable" ]]; then
    printf "%s\n" "$executable"
    return
  fi
  find "$release_dir/app" -maxdepth 1 -type f -executable -name "conduit-stage*" | head -n 1
}

install_artifact() {
  ensure_stage_dirs
  local artifact_path="${1:-}"
  if [[ -z "$artifact_path" ]]; then
    printf "install-artifact requires a tarball path\n" >&2
    exit 1
  fi
  local scratch_dir="$BUILD_DIR/install-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  run rm -rf "$scratch_dir"
  run mkdir -p "$scratch_dir"
  run tar -xzf "$artifact_path" -C "$scratch_dir"
  local extracted_dir
  extracted_dir="$(find "$scratch_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$extracted_dir" ]]; then
    printf "Artifact did not contain a release directory: %s\n" "$artifact_path" >&2
    exit 1
  fi
  validate_release_dir "$extracted_dir"

  local release_name
  release_name="$(basename "$extracted_dir")"
  local release_dir="$RELEASES_DIR/$release_name"
  run rm -rf "$release_dir"
  run mv "$extracted_dir" "$release_dir"
  run rm -rf "$scratch_dir"
  ln -sfn "$release_dir" "$CURRENT_LINK"
  write_stage_runner
  printf "Stage installed: %s\n" "$release_dir"
}

deploy_stage() {
  build_artifact
  local latest_artifact
  latest_artifact="$(find "$ARTIFACTS_DIR" -maxdepth 1 -type f -name "conduit-stage-*-linux-x64.tar.gz" -printf "%T@ %p\n" | sort -nr | head -n 1 | cut -d " " -f 2-)"
  install_artifact "$latest_artifact"
  stop_stage
  start_stage
}

start_stage() {
  ensure_stage_dirs
  local current_release
  current_release="$(release_dir)" || {
    printf "No stage release found. Run: %s refresh\n" "$0" >&2
    exit 1
  }
  validate_release_dir "$current_release"

  if ! pid_running "$ELECTRON_PID_FILE"; then
    if [[ -z "$RELAY_ENDPOINT" ]]; then
      printf "CONDUIT_STAGE_RELAY_ENDPOINT or CONDUIT_RELAY_ENDPOINT is required for stage desktop runtime\n" >&2
      exit 1
    fi
    local executable
    executable="$(stage_executable_for_release "$current_release")"
    local resources_dir="$current_release/app/resources/stage-resources"
    local acp_vendor_root="$current_release/app/resources/stage-resources/vendor/agent-client-protocol"
    RUNNER_TRACKING_ID="" \
      CONDUIT_ACP_VENDOR_ROOT="$acp_vendor_root" \
      CONDUIT_DESKTOP_APP_BASE_URL="$APP_BASE_URL" \
      CONDUIT_DESKTOP_BACKEND_HOST="$BACKEND_HOST" \
      CONDUIT_DESKTOP_BACKEND_LOG_PATH="$BACKEND_LOG_BASE_PATH" \
      CONDUIT_DESKTOP_BACKEND_PID_PATH="$BACKEND_PID_FILE" \
      CONDUIT_DESKTOP_BACKEND_PORT="$BACKEND_PORT" \
      CONDUIT_DESKTOP_HOME="$DATA_ROOT" \
      CONDUIT_DESKTOP_LOG_PROFILE="stage" \
      CONDUIT_DESKTOP_RELAY_ENDPOINT="$RELAY_ENDPOINT" \
      CONDUIT_DESKTOP_SERVICE_BIN="$resources_dir/bin/service-bin" \
      CONDUIT_DESKTOP_STORE_PATH="$DATA_ROOT/local-store.sqlite3" \
      CONDUIT_DESKTOP_WEB_DIR="$resources_dir/web" \
      setsid "$executable" >"$LOG_DIR/electron.log" 2>&1 < /dev/null &
    printf "%s" "$!" >"$ELECTRON_PID_FILE"
    sleep 0.2
    if ! pid_running "$ELECTRON_PID_FILE"; then
      printf "Electron failed to start. See %s/electron.log\n" "$LOG_DIR" >&2
      exit 1
    fi
  fi

  if ! wait_for_runtime_ready; then
    printf "Stage runtime failed readiness checks. See %s/electron.log and %s\n" "$LOG_DIR" "$BACKEND_LOG_BASE_PATH" >&2
    exit 1
  fi

  printf "Backend: ws://%s:%s/api/session\n" "$BACKEND_HOST" "$BACKEND_PORT"
  printf "Web: conduit-desktop://desktop/\n"
}

stop_stage() {
  if pid_running "$ELECTRON_PID_FILE"; then
    local pid
    pid="$(cat "$ELECTRON_PID_FILE")"
    kill "$pid" >/dev/null 2>&1 || true
    wait_for_pid_exit "$pid"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -KILL "$pid" >/dev/null 2>&1 || true
      wait_for_pid_exit "$pid"
    fi
  fi
  rm -f "$ELECTRON_PID_FILE"

  if pid_running "$BACKEND_PID_FILE"; then
    local backend_pid
    backend_pid="$(cat "$BACKEND_PID_FILE")"
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait_for_pid_exit "$backend_pid"
    if kill -0 "$backend_pid" >/dev/null 2>&1; then
      kill -KILL "$backend_pid" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$BACKEND_PID_FILE"
}

status_stage() {
  local current_release
  if current_release="$(release_dir)"; then
    printf "Release: %s\n" "$current_release"
  else
    printf "Release: none\n"
  fi

  if pid_running "$ELECTRON_PID_FILE"; then
    printf "Electron: running (pid %s)\n" "$(cat "$ELECTRON_PID_FILE")"
  else
    printf "Electron: stopped\n"
  fi

  if pid_running "$BACKEND_PID_FILE"; then
    printf "Backend: running (pid %s)\n" "$(cat "$BACKEND_PID_FILE")"
  else
    printf "Backend: stopped\n"
  fi

  printf "Web: Electron protocol conduit-desktop://desktop/\n"
}

verify_stage() {
  local expected_commit="${1:-}"
  if [[ -z "$expected_commit" ]]; then
    printf "verify requires the expected source commit\n" >&2
    exit 1
  fi

  local current_release
  current_release="$(release_dir)" || {
    printf "No stage release found\n" >&2
    exit 1
  }
  validate_release_dir "$current_release"

  local manifest_path="$current_release/manifest.json"
  local manifest_commit
  manifest_commit="$(json_field "$manifest_path" commit)"
  if [[ "$manifest_commit" != "$expected_commit" ]]; then
    printf "Stage manifest commit mismatch: expected %s, got %s\n" "$expected_commit" "$manifest_commit" >&2
    exit 1
  fi

  if ! pid_running "$ELECTRON_PID_FILE"; then
    printf "Electron is not running\n" >&2
    exit 1
  fi

  if ! pid_running "$BACKEND_PID_FILE"; then
    printf "Backend is not running\n" >&2
    exit 1
  fi

  if ! wait_for_runtime_ready; then
    printf "Stage readiness checks failed\n" >&2
    exit 1
  fi

  printf "Stage verified: %s\n" "$expected_commit"
}

install_desktop_entry() {
  if [[ -z "$RELAY_ENDPOINT" ]]; then
    printf "CONDUIT_STAGE_RELAY_ENDPOINT or CONDUIT_RELAY_ENDPOINT is required to install the stage desktop entry\n" >&2
    exit 1
  fi
  local applications_dir
  applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  local desktop_file="$applications_dir/conduit-stage.desktop"
  local icon_file="$STAGE_ROOT/conduit-stage.svg"
  run mkdir -p "$applications_dir"
  run mkdir -p "$STAGE_ROOT"
  cat >"$icon_file" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="stage-bg" x1="18" y1="14" x2="110" y2="114" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="0.52" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#stage-bg)"/>
  <path d="M38 64c0-17.7 11.9-30 29.1-30 10 0 18.8 4.4 24.2 12.1l-10.7 8.1c-3.3-4.5-7.5-6.7-13.1-6.7-9.1 0-15.1 6.6-15.1 16.5s6 16.5 15.1 16.5c5.6 0 9.8-2.2 13.1-6.7l10.7 8.1C85.9 89.6 77.1 94 67.1 94 49.9 94 38 81.7 38 64Z" fill="#f8fafc"/>
  <path d="M34 104h60" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
</svg>
EOF
  cat >"$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Conduit Stage
Comment=Run isolated Conduit Electron stage build
Exec=env CONDUIT_STAGE_RELAY_ENDPOINT=${RELAY_ENDPOINT} ${RUNNER_PATH} open
Terminal=false
Icon=${icon_file}
Categories=Development;
StartupNotify=true
StartupWMClass=conduit-stage
EOF
  printf "Desktop entry installed: %s\n" "$desktop_file"
}

show_logs() {
  local stream="${1:-all}"
  case "$stream" in
    backend)
      local backend_log_path
      backend_log_path="$(latest_rotated_log_path "$BACKEND_LOG_BASE_PATH")"
      if [[ -z "$backend_log_path" ]]; then
        printf "No backend log file found for base path %s\n" "$BACKEND_LOG_BASE_PATH" >&2
        exit 1
      fi
      tail -n 200 "$backend_log_path"
      ;;
    electron | web)
      tail -n 200 "$LOG_DIR/electron.log"
      ;;
    frontend)
      tail -n 200 "$FRONTEND_LOG_PATH"
      ;;
    all)
      printf "Backend log base: %s\n" "$BACKEND_LOG_BASE_PATH"
      printf "Electron log: %s/electron.log\n" "$LOG_DIR"
      printf "Frontend log: %s\n" "$FRONTEND_LOG_PATH"
      ;;
    *)
      printf "Unknown log stream: %s\n" "$stream" >&2
      exit 1
      ;;
  esac
}

latest_rotated_log_path() {
  local base_path="$1"
  local parent_dir
  local file_name
  local stem
  local extension=""
  parent_dir="$(dirname "$base_path")"
  file_name="$(basename "$base_path")"
  stem="$file_name"
  if [[ "$file_name" == *.* ]]; then
    extension=".${file_name##*.}"
    stem="${file_name%.*}"
  fi
  find "$parent_dir" -maxdepth 1 -type f -name "${stem}-*${extension}" -printf "%T@ %p\n" 2>/dev/null |
    sort -nr |
    head -n 1 |
    cut -d " " -f 2-
}

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  build-artifact         Build selected ref (default: HEAD) into a stage tarball
  install-artifact PATH  Install a stage tarball and update current atomically
  deploy                 Build, install, stop old stage, and start new stage
  refresh                Alias for deploy
  start                  Start packaged Electron stage and wait for readiness
  stop                   Stop packaged Electron stage and child backend process
  status                 Show current release and process status
  verify COMMIT          Verify current stage is running the expected commit
  open                   Start stage if needed
  logs [backend|frontend|electron|web] Show recent log output
  install-desktop-entry  Install a desktop launcher for stage open
EOF
}

command="${1:-}"
case "$command" in
  build-artifact)
    build_artifact
    ;;
  install-artifact)
    install_artifact "${2:-}"
    ;;
  deploy | refresh)
    deploy_stage
    ;;
  start | open)
    start_stage
    ;;
  stop)
    stop_stage
    ;;
  status)
    status_stage
    ;;
  verify)
    if [[ "${2:-}" == "--" ]]; then
      verify_stage "${3:-}"
    else
      verify_stage "${2:-}"
    fi
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
