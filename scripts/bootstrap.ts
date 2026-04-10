import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const commands: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["pnpm", ["run", "toolchain:check"]],
  ["pnpm", ["run", "structure:check"]],
  ["pnpm", ["run", "build"]],
  ["pnpm", ["run", "rust:metadata"]],
  ["pnpm", ["run", "rust:build"]],
];

process.chdir(repoRoot);

for (const [command, args] of commands) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, [...args], { cwd: repoRoot, stdio: "inherit" });
}

console.log("Conduit frontend foundation bootstrap completed.");
