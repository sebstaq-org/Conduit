import {
  appBundleId,
  buildIosSimulatorProfile,
  ensureIosSimulatorWorkspace,
  remoteInstallAndLaunchScript,
  runRemoteBash,
} from "./iosSimulatorHarness.ts";
import type { IosSimulatorProfile, WorkspaceInfo } from "./iosSimulatorHarness.ts";

const profile: IosSimulatorProfile = {
  artifactName: "Conduit-stage-simulator.tar.gz",
  easProfile: "stage-simulator",
};

function remoteSmokeScript(workspace: WorkspaceInfo): string {
  return remoteInstallAndLaunchScript({
    artifactName: profile.artifactName,
    extractName: "e2e-stage-simulator",
    postLaunchScript: `
sleep 8

screenshot_path=$(mktemp "\${TMPDIR:-/tmp}/conduit-ios-smoke.XXXXXX.png")
xcrun simctl io "$device_name" screenshot "$screenshot_path" >/dev/null

screenshot_size=$(stat -f%z "$screenshot_path")
screenshot_width=$(sips -g pixelWidth "$screenshot_path" | awk '/pixelWidth/ {print $2}')
screenshot_height=$(sips -g pixelHeight "$screenshot_path" | awk '/pixelHeight/ {print $2}')
if [[ "$screenshot_size" -lt 5000 || "$screenshot_width" -lt 300 || "$screenshot_height" -lt 500 ]]; then
  echo "ios-smoke: invalid screenshot \${screenshot_width}x\${screenshot_height} bytes=\${screenshot_size}" >&2
  rm -f "$screenshot_path"
  exit 21
fi
echo "ios-smoke: screenshot=\${screenshot_width}x\${screenshot_height} bytes=\${screenshot_size}"
echo "ios-smoke: launched $bundle_id on $device_name"
rm -f "$screenshot_path"
`,
    workspace,
  });
}

async function main(): Promise<void> {
  const workspace = await ensureIosSimulatorWorkspace();
  await buildIosSimulatorProfile(profile);
  await runRemoteBash(remoteSmokeScript(workspace));
}

await main();
