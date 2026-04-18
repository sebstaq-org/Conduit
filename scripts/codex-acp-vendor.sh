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
  local libcap_root="/srv/devops/repos/vendor/libcap-dev-extract"
  local pkgconfig_dir="$libcap_root/usr/lib/x86_64-linux-gnu/pkgconfig"
  if [[ -d "$pkgconfig_dir" && -z "${PKG_CONFIG_PATH:-}" ]]; then
    export PKG_CONFIG_PATH="$pkgconfig_dir"
  fi
  if [[ -d "$libcap_root" && -z "${PKG_CONFIG_SYSROOT_DIR:-}" ]]; then
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
  run install -m 0755 "$ADAPTER_DIR/target/release/codex-acp" "$BIN_PATH"
  printf "codex-acp installed: %s\n" "$BIN_PATH"
}

case "${1:-build}" in
  build)
    build_adapter
    ;;
  print-bin)
    printf "%s\n" "$BIN_PATH"
    ;;
  *)
    printf "Usage: %s [build|print-bin]\n" "$0" >&2
    exit 1
    ;;
esac
