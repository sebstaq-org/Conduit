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

interface IosSimulatorProfile {
  readonly artifactName: string;
  readonly easProfile: string;
}

const appBundleId = "com.sebstaq.conduit";
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
      console.log(`[ios-sim] ${commandLine(command, args)}`);
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

async function ensureIosSimulatorWorkspace(): Promise<WorkspaceInfo> {
  const workspace = await readWorkspaceInfo();
  console.log(
    `[ios-sim] workspace=${workspace.workspace} simulator=${workspace.simulator_name}`,
  );
  await run("rtk", [
    "base-cli",
    "workspace",
    "ensure",
    "--cwd",
    repoRoot,
    "--bootstrap-simulators",
  ]);
  return workspace;
}

async function buildIosSimulatorProfile(
  profile: IosSimulatorProfile,
): Promise<void> {
  await run("rtk", [
    "base-cli",
    "ios",
    "build",
    "--profile",
    profile.easProfile,
    "--cwd",
    repoRoot,
    "--non-interactive",
  ]);
}

async function runRemoteBash(script: string): Promise<CommandResult> {
  return run("rtk", [
    "base-cli",
    "ssh",
    "exec",
    "--cwd",
    repoRoot,
    "--",
    "/bin/bash",
    "-lc",
    script,
  ]);
}

function remoteInstallAndLaunchScript(args: {
  readonly artifactName: string;
  readonly extractName: string;
  readonly postLaunchScript: string;
  readonly workspace: WorkspaceInfo;
}): string {
  const artifactPath = `${args.workspace.remote_work_dir}/artifacts/ios/${args.artifactName}`;
  const extractDir = `${args.workspace.remote_work_dir}/artifacts/ios/${args.extractName}`;
  const appPath = `${extractDir}/Conduit.app`;

  return `set -euo pipefail
PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PATH

device_name=${JSON.stringify(args.workspace.simulator_name)}
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
  echo "ios-sim: no .app found in $artifact_path" >&2
  exit 20
fi

xcrun simctl boot "$device_name" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$device_name" -b
xcrun simctl terminate "$device_name" "$bundle_id" >/dev/null 2>&1 || true
xcrun simctl uninstall "$device_name" "$bundle_id" >/dev/null 2>&1 || true
xcrun simctl install "$device_name" "$app_path"

marker_path=$(mktemp "\${TMPDIR:-/tmp}/conduit-ios-marker.XXXXXX")
touch "$marker_path"
launch_output=$(xcrun simctl launch "$device_name" "$bundle_id" 2>&1)
printf '%s\\n' "$launch_output"
launch_pid=$(printf '%s\\n' "$launch_output" | awk -F': ' '/^[^:]+: [0-9]+$/ {print $2}' | tail -n 1)

cleanup() {
  rm -f "$marker_path"
  rm -rf "$extract_dir"
}
trap cleanup EXIT

${args.postLaunchScript}
`;
}

export {
  appBundleId,
  buildIosSimulatorProfile,
  ensureIosSimulatorWorkspace,
  remoteInstallAndLaunchScript,
  repoRoot,
  run,
  runRemoteBash,
};
export type { IosSimulatorProfile, WorkspaceInfo };
