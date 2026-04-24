import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface WorkspaceInfo {
  readonly remote_work_dir: string;
  readonly simulator_name: string;
  readonly workspace: string;
}

interface CommandResult {
  readonly stdout: string;
}

const appBundleId = "com.sebstaq.conduit";
const artifactName = "Conduit-stage-simulator.tar.gz";
const easProfile = "stage-simulator";
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "../../..");

function commandLine(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

function run(
  command: string,
  args: readonly string[],
  options: { readonly quiet?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolveCommand, reject) => {
    if (!options.quiet) {
      console.log(`[ios-smoke] ${commandLine(command, args)}`);
    }

    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (!options.quiet) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (!options.quiet) {
        process.stderr.write(chunk);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveCommand({ stdout });
        return;
      }

      reject(
        new Error(
          `${commandLine(command, args)} exited with ${code}\n${stderr}`,
        ),
      );
    });
  });
}

async function readWorkspaceInfo(): Promise<WorkspaceInfo> {
  const result = await run(
    "rtk",
    ["base-cli", "workspace", "info", "--cwd", repoRoot, "--json"],
    { quiet: true },
  );
  return JSON.parse(result.stdout) as WorkspaceInfo;
}

function remoteSmokeScript(workspace: WorkspaceInfo): string {
  const artifactPath = `${workspace.remote_work_dir}/artifacts/ios/${artifactName}`;
  const extractDir = `${workspace.remote_work_dir}/artifacts/ios/e2e-stage-simulator`;
  const appPath = `${extractDir}/Conduit.app`;

  return `set -euo pipefail
PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PATH

device_name=${JSON.stringify(workspace.simulator_name)}
bundle_id=${JSON.stringify(appBundleId)}
artifact_path=${JSON.stringify(artifactPath)}
extract_dir=${JSON.stringify(extractDir)}
app_path=${JSON.stringify(appPath)}

rm -rf "$extract_dir"
mkdir -p "$extract_dir"
tar -xzf "$artifact_path" -C "$extract_dir"
if [[ ! -d "$app_path" ]]; then
  app_path=$(find "$extract_dir" -maxdepth 2 -name "*.app" -type d | head -n 1)
fi
if [[ -z "\${app_path:-}" || ! -d "$app_path" ]]; then
  echo "ios-smoke: no .app found in $artifact_path" >&2
  exit 20
fi

xcrun simctl boot "$device_name" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$device_name" -b
xcrun simctl uninstall "$device_name" "$bundle_id" >/dev/null 2>&1 || true
xcrun simctl install "$device_name" "$app_path"
xcrun simctl launch "$device_name" "$bundle_id"
sleep 8

screenshot_path=$(mktemp "\${TMPDIR:-/tmp}/conduit-ios-smoke.XXXXXX.png")
cleanup() {
  rm -f "$screenshot_path"
  rm -rf "$extract_dir"
}
trap cleanup EXIT
xcrun simctl io "$device_name" screenshot "$screenshot_path" >/dev/null

screenshot_size=$(stat -f%z "$screenshot_path")
screenshot_width=$(sips -g pixelWidth "$screenshot_path" | awk '/pixelWidth/ {print $2}')
screenshot_height=$(sips -g pixelHeight "$screenshot_path" | awk '/pixelHeight/ {print $2}')
if [[ "$screenshot_size" -lt 5000 || "$screenshot_width" -lt 300 || "$screenshot_height" -lt 500 ]]; then
  echo "ios-smoke: invalid screenshot \${screenshot_width}x\${screenshot_height} bytes=\${screenshot_size}" >&2
  exit 21
fi
echo "ios-smoke: screenshot=\${screenshot_width}x\${screenshot_height} bytes=\${screenshot_size}"
echo "ios-smoke: launched $bundle_id on $device_name"
`;
}

async function main(): Promise<void> {
  const workspace = await readWorkspaceInfo();
  console.log(
    `[ios-smoke] workspace=${workspace.workspace} simulator=${workspace.simulator_name}`,
  );
  await run("rtk", [
    "base-cli",
    "workspace",
    "ensure",
    "--cwd",
    repoRoot,
    "--bootstrap-simulators",
  ]);
  await run("rtk", [
    "base-cli",
    "ios",
    "build",
    "--profile",
    easProfile,
    "--cwd",
    repoRoot,
    "--non-interactive",
  ]);
  await run("rtk", [
    "base-cli",
    "ssh",
    "exec",
    "--cwd",
    repoRoot,
    "--",
    "/bin/bash",
    "-lc",
    remoteSmokeScript(workspace),
  ]);
}

await main();
