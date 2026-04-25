import {
  buildIosSimulatorProfile,
  ensureIosSimulatorWorkspace,
  remoteInstallAndLaunchScript,
  runRemoteBash,
} from "./iosSimulatorHarness.ts";
import type {
  IosSimulatorProfile,
  WorkspaceInfo,
} from "./iosSimulatorHarness.ts";

const profile: IosSimulatorProfile = {
  artifactName: "Conduit-stage-simulator-markdown-repro.tar.gz",
  easProfile: "stage-simulator-markdown-repro",
};

function expectsCrash(): boolean {
  return process.argv.includes("--expect-crash");
}

function remoteMarkdownCrashScript(args: {
  readonly expectCrash: boolean;
  readonly workspace: WorkspaceInfo;
}): string {
  const expectCrashValue = args.expectCrash ? "1" : "0";
  return remoteInstallAndLaunchScript({
    artifactName: profile.artifactName,
    extractName: "e2e-stage-simulator-markdown-repro",
    postLaunchScript: `
expect_crash=${expectCrashValue}
xcrun simctl terminate "$device_name" "$bundle_id" >/dev/null 2>&1 || true
console_path=$(mktemp "\${TMPDIR:-/tmp}/conduit-ios-console.XXXXXX.log")
xcrun simctl launch --console "$device_name" "$bundle_id" > "$console_path" 2>&1 &
console_pid=$!
console_signature=0
for _attempt in $(seq 1 35); do
  if grep -Eq "facebook::jsi::JSError: Object is not a function" "$console_path" && grep -Eq "pnpm_remendWorkletJs1|remendWorklet" "$console_path"; then
    console_signature=1
    break
  fi
  if ! kill -0 "$console_pid" >/dev/null 2>&1; then
    wait "$console_pid" >/dev/null 2>&1 || true
    break
  fi
  sleep 1
done

if kill -0 "$console_pid" >/dev/null 2>&1; then
  xcrun simctl terminate "$device_name" "$bundle_id" >/dev/null 2>&1 || true
  kill "$console_pid" >/dev/null 2>&1 || true
  wait "$console_pid" >/dev/null 2>&1 || true
fi

cat "$console_path"

crash_report=$(find "$HOME/Library/Logs/DiagnosticReports" -type f \\( -name "Conduit*.ips" -o -name "Conduit*.crash" \\) -newer "$marker_path" -print 2>/dev/null | sort | tail -n 1 || true)
crash_signature=0
if [[ -n "$crash_report" ]]; then
  echo "ios-markdown-repro: crash-report=$(basename "$crash_report")"
  if grep -Eq "remend-processor_queue|remend-processor\\(timeout\\)" "$crash_report" && grep -Eq "SIGABRT|EXC_CRASH" "$crash_report" && grep -Eq "HermesRuntimeImpl::call|HermesRuntimeImpl::throwPendingError" "$crash_report"; then
    crash_signature=1
    echo "ios-markdown-repro: signature=remend-processor_queue SIGABRT HermesRuntimeImpl"
  else
    echo "ios-markdown-repro: signature=unexpected"
    grep -E "Exception Type|Termination Reason|Triggered by Thread|remend-processor_queue|HermesRuntimeImpl" "$crash_report" | head -n 16 || true
  fi
fi

if [[ "$expect_crash" == "1" ]]; then
  if [[ "$console_signature" == "1" ]]; then
    echo "ios-markdown-repro: signature=facebook::jsi::JSError Object is not a function pnpm_remendWorkletJs1"
    echo "ios-markdown-repro: reproduced expected native markdown crash"
    rm -f "$console_path"
    exit 0
  fi
  if [[ "$crash_signature" == "1" ]]; then
    echo "ios-markdown-repro: reproduced expected native markdown crash"
    rm -f "$console_path"
    exit 0
  fi
  echo "ios-markdown-repro: expected crash signature was not observed" >&2
  rm -f "$console_path"
  exit 31
fi

if [[ "$console_signature" == "1" || "$crash_signature" == "1" ]]; then
  echo "ios-markdown-repro: app crashed while rendering markdown" >&2
  rm -f "$console_path"
  exit 32
fi

screenshot_path=$(mktemp "\${TMPDIR:-/tmp}/conduit-ios-markdown.XXXXXX.png")
xcrun simctl io "$device_name" screenshot "$screenshot_path" >/dev/null
screenshot_size=$(stat -f%z "$screenshot_path")
rm -f "$screenshot_path"
if [[ "$screenshot_size" -lt 5000 ]]; then
  echo "ios-markdown-repro: invalid screenshot bytes=$screenshot_size" >&2
  exit 33
fi
echo "ios-markdown-repro: markdown rendered without native crash"
rm -f "$console_path"
`,
    workspace: args.workspace,
  });
}

async function main(): Promise<void> {
  const workspace = await ensureIosSimulatorWorkspace();
  await buildIosSimulatorProfile(profile);
  await runRemoteBash(
    remoteMarkdownCrashScript({
      expectCrash: expectsCrash(),
      workspace,
    }),
  );
}

await main();
