import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageJson {
  engines?: {
    node?: string;
    pnpm?: string;
  };
  packageManager?: string;
}

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "package.json"), "utf8"),
) as PackageJson;
const expectedNodeVersion = readFileSync(
  resolve(repoRoot, ".nvmrc"),
  "utf8",
).trim();
const expectedPnpmVersion = packageJson.packageManager?.replace(/^pnpm@/, "");
const rustToolchainFile = readFileSync(
  resolve(repoRoot, "backend/service/rust-toolchain.toml"),
  "utf8",
);
const rustChannelMatch = rustToolchainFile.match(/channel = "([^"]+)"/u);

const expectedRustVersion = rustChannelMatch?.[1];
const actualPnpmVersion = execFileSync("pnpm", ["-v"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();
const actualRustVersion = execFileSync("rustc", ["-V"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .trim()
  .match(/^rustc ([^\s]+)/u)?.[1];
const resolvedRustVersion = actualRustVersion ?? "unknown";

const failures: string[] = [];

if (process.version !== `v${expectedNodeVersion}`) {
  failures.push(
    `Node version mismatch: expected v${expectedNodeVersion}, got ${process.version}.`,
  );
}

if (packageJson.engines?.node !== expectedNodeVersion) {
  failures.push(
    `package.json engines.node must match .nvmrc (${expectedNodeVersion}).`,
  );
}

if (expectedPnpmVersion === undefined) {
  failures.push(
    "package.json must pin packageManager to an exact pnpm version.",
  );
} else {
  if (actualPnpmVersion !== expectedPnpmVersion) {
    failures.push(
      `pnpm version mismatch: expected ${expectedPnpmVersion}, got ${actualPnpmVersion}.`,
    );
  }

  if (packageJson.engines?.pnpm !== expectedPnpmVersion) {
    failures.push(
      `package.json engines.pnpm must match packageManager (${expectedPnpmVersion}).`,
    );
  }
}

if (expectedRustVersion === undefined) {
  failures.push(
    "backend/service/rust-toolchain.toml must pin an exact channel.",
  );
} else if (actualRustVersion !== expectedRustVersion) {
  failures.push(
    `Rust version mismatch: expected ${expectedRustVersion}, got ${resolvedRustVersion}.`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }

  process.exit(1);
}

console.log(
  `Toolchain locked: node v${expectedNodeVersion}, pnpm ${actualPnpmVersion}, rust ${resolvedRustVersion}.`,
);
