#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ADAPTER_DIR="$REPO_ROOT/vendor/codex-acp"
BIN_DIR="$REPO_ROOT/.conduit/bin"
BIN_PATH="$BIN_DIR/codex-acp"

run() {
  if command -v rtk >/dev/null 2>&1; then
    rtk "$@"
    return
  fi
  "$@"
}

configure_libcap_defaults() {
  if command -v pkg-config >/dev/null 2>&1 && pkg-config --exists libcap; then
    return
  fi

  local libcap_root="${CONDUIT_CODEX_ACP_LIBCAP_SYSROOT:-}"
  if [[ -z "$libcap_root" && -d "/srv/devops/repos/vendor/libcap-dev-extract" ]]; then
    libcap_root="/srv/devops/repos/vendor/libcap-dev-extract"
    printf "Using local Codex ACP libcap sysroot fallback: %s\n" "$libcap_root" >&2
  fi
  if [[ -z "$libcap_root" ]]; then
    return
  fi

  local pkgconfig_dir="$libcap_root/usr/lib/x86_64-linux-gnu/pkgconfig"
  if [[ -d "$pkgconfig_dir" && -z "${PKG_CONFIG_PATH:-}" ]]; then
    export PKG_CONFIG_PATH="$pkgconfig_dir"
  fi
  if [[ -z "${PKG_CONFIG_SYSROOT_DIR:-}" ]]; then
    export PKG_CONFIG_SYSROOT_DIR="$libcap_root"
  fi
}

build_adapter() {
  if [[ ! -f "$ADAPTER_DIR/Cargo.toml" ]]; then
    printf "Missing vendored Codex ACP source: %s\n" "$ADAPTER_DIR" >&2
    exit 1
  fi

  configure_libcap_defaults
  run cargo build --locked --manifest-path "$ADAPTER_DIR/Cargo.toml" --release
  run mkdir -p "$BIN_DIR"
  run install -m 0755 "$(adapter_target_dir)/release/codex-acp" "$BIN_PATH"
  printf "codex-acp installed: %s\n" "$BIN_PATH"
}

adapter_target_dir() {
  local metadata
  metadata="$(cargo metadata --locked --manifest-path "$ADAPTER_DIR/Cargo.toml" --format-version 1 --no-deps)"
  node -e '
const fs = require("node:fs");
const metadata = JSON.parse(fs.readFileSync(0, "utf8"));
if (typeof metadata.target_directory !== "string") {
  throw new Error("cargo metadata did not include target_directory");
}
process.stdout.write(metadata.target_directory);
' <<<"$metadata"
}

verify_adapter() {
  if [[ ! -x "$BIN_PATH" ]]; then
    printf "Missing executable managed codex-acp: %s\n" "$BIN_PATH" >&2
    exit 1
  fi
  run "$BIN_PATH" --help >/dev/null
  printf "codex-acp verified: %s\n" "$BIN_PATH"
}

case "${1:-build}" in
  build)
    build_adapter
    ;;
  check)
    build_adapter
    verify_adapter
    ;;
  print-bin)
    printf "%s\n" "$BIN_PATH"
    ;;
  verify)
    verify_adapter
    ;;
  *)
    printf "Usage: %s [build|check|print-bin|verify]\n" "$0" >&2
    exit 1
    ;;
esac
