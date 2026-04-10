# Phase 1.5 Checkpoint 3: Runtime CLI Smoke Path

This proof covers the third Phase 1.5 checkpoint: adding a non-proof `service-bin runtime ... --json` path that routes through `service-runtime`.

The runtime smoke command `runtime initialize --provider codex --json` returns a stable consumer response envelope on stdout and does not require `--artifact-root`. The negative smoke command `runtime provider/snapshot --provider invalid --json` returns a stable `unknown_provider` envelope from `service-runtime`, not a CLI parse failure.

The proof command `contracts --artifact-root artifacts/manual/phase-1.5/checkpoint-3-runtime-cli/proof-contracts` still writes artifacts separately, proving runtime and proof paths remain visibly separate.

Verification commands are listed in `command.txt`; combined command output is captured in `stdout.log` and `stderr.log`.
