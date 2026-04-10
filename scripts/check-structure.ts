import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface WorkspaceUnit {
  kind: "app" | "package";
  manifest: Manifest;
  rootPath: string;
  dependencies: Set<string>;
}

export interface CargoMetadataPackage {
  id: string;
  manifest_path: string;
  name: string;
}

export interface CargoMetadataNode {
  dependencies: string[];
  id: string;
}

export interface CargoMetadata {
  packages: CargoMetadataPackage[];
  resolve?: {
    nodes: CargoMetadataNode[];
  };
  workspace_members: string[];
}

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const allowedTopLevelDirs = new Set([
  "apps",
  "artifacts",
  "backend",
  "docs",
  "packages",
  "scripts",
  "vendor",
]);
const forbiddenTopLevelDirs = new Set([
  "rust",
  "shared",
  "core",
  "utils",
  "misc",
  "tmp",
]);
const approvedApps = new Set(["desktop", "mobile"]);
const approvedPackages = new Set([
  "provider-catalog",
  "session-client",
  "session-contracts",
  "session-model",
  "ui",
]);
const approvedCrates = new Set([
  "acp-contracts",
  "acp-core",
  "acp-discovery",
  "app-api",
  "provider-claude",
  "provider-codex",
  "provider-copilot",
  "service-bin",
  "session-store",
]);
const approvedArtifactRoots = new Set(["automated", "manual"]);
const approvedVendorRoots = new Set(["agent-client-protocol"]);
const approvedTestdataRoots = new Set(["failures", "golden", "providers"]);
const ignoredTopLevelDirs = new Set(["node_modules"]);
const approvedProviderCrates = [...approvedCrates].filter((crateName) =>
  crateName.startsWith("provider-"),
);
const allowedArtifactExtensions = new Set([
  "",
  ".csv",
  ".gitkeep",
  ".gz",
  ".html",
  ".jpeg",
  ".jpg",
  ".json",
  ".log",
  ".md",
  ".ndjson",
  ".pdf",
  ".png",
  ".svg",
  ".tgz",
  ".txt",
  ".webp",
  ".zip",
]);
const allowedVendorExtensions = new Set([
  "",
  ".gitkeep",
  ".json",
  ".lock",
  ".md",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
]);

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function visibleDirectories(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function walkFiles(directoryPath: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (["dist", "node_modules", "target"].includes(entry.name)) {
      continue;
    }

    const absolutePath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function toPortableRelativePath(fromPath: string, toPath: string): string {
  return relative(fromPath, toPath).split("\\").join("/");
}

function assertExactChildren(
  parentPath: string,
  expected: Set<string>,
  label: string,
  failures: string[],
): void {
  const actual = visibleDirectories(parentPath);

  for (const directoryName of actual) {
    if (!expected.has(directoryName)) {
      failures.push(`${label} contains unexpected directory ${directoryName}.`);
    }
  }

  for (const directoryName of expected) {
    if (!actual.includes(directoryName)) {
      failures.push(`${label} is missing required directory ${directoryName}.`);
    }
  }
}

function allowedExtensionFor(
  filePath: string,
  allowedExtensions: Set<string>,
): boolean {
  const extension = extname(filePath);
  const baseName = filePath.split("/").at(-1) ?? "";

  if (baseName === ".gitkeep") {
    return allowedExtensions.has(".gitkeep");
  }

  return allowedExtensions.has(extension);
}

function readWorkspaceUnit(
  kind: "app" | "package",
  relativeRoot: string,
): WorkspaceUnit {
  const rootPath = resolve(repoRoot, relativeRoot);
  const manifest = readJson(resolve(rootPath, "package.json")) as Manifest;
  const dependencies = new Set<string>([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  return { kind, manifest, rootPath, dependencies };
}

function importSpecifiers(sourceCode: string): string[] {
  const matches = sourceCode.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gu,
  );

  return [...matches]
    .map((match) => match[1] ?? match[2])
    .filter((specifier): specifier is string => specifier !== undefined);
}

function checkWorkspaceImports(
  workspaceUnits: ReadonlyMap<string, WorkspaceUnit>,
  workspaceUnitsByName: ReadonlyMap<string, WorkspaceUnit>,
  failures: string[],
): void {
  for (const unit of workspaceUnits.values()) {
    const sourceFiles = walkFiles(resolve(unit.rootPath, "src")).filter(
      (filePath) => filePath.endsWith(".ts"),
    );

    for (const filePath of sourceFiles) {
      const sourceCode = readFileSync(filePath, "utf8");
      const specifiers = importSpecifiers(sourceCode);

      for (const specifier of specifiers) {
        if (specifier.startsWith(".")) {
          const resolvedImport = resolve(dirname(filePath), specifier);
          const relativeImportPath = toPortableRelativePath(
            unit.rootPath,
            resolvedImport,
          );

          if (relativeImportPath.startsWith("..")) {
            failures.push(
              `${toPortableRelativePath(repoRoot, filePath)} reaches outside ${unit.manifest.name} via ${specifier}.`,
            );
          }

          continue;
        }

        if (
          specifier.startsWith("/") ||
          specifier.startsWith("apps/") ||
          specifier.startsWith("packages/") ||
          specifier.startsWith("backend/") ||
          specifier.startsWith("vendor/") ||
          specifier.startsWith("artifacts/")
        ) {
          failures.push(
            `${toPortableRelativePath(repoRoot, filePath)} uses repo-path import ${specifier}; use package boundaries instead.`,
          );
          continue;
        }

        if (!specifier.startsWith("@conduit/")) {
          continue;
        }

        const packageName = specifier.split("/").slice(0, 2).join("/");
        const targetUnit = workspaceUnitsByName.get(packageName);

        if (targetUnit === undefined) {
          failures.push(
            `${toPortableRelativePath(repoRoot, filePath)} imports unknown workspace package ${specifier}.`,
          );
          continue;
        }

        if (unit.manifest.name === targetUnit.manifest.name) {
          continue;
        }

        if (unit.kind === "app" && targetUnit.kind === "app") {
          failures.push(
            `${toPortableRelativePath(repoRoot, filePath)} crosses app boundary via ${specifier}.`,
          );
          continue;
        }

        if (unit.kind === "package" && targetUnit.kind === "app") {
          failures.push(
            `${toPortableRelativePath(repoRoot, filePath)} imports app code via ${specifier}.`,
          );
          continue;
        }

        if (!unit.dependencies.has(packageName)) {
          failures.push(
            `${toPortableRelativePath(repoRoot, filePath)} imports ${specifier} without declaring ${packageName}.`,
          );
        }
      }
    }
  }
}

export function loadCargoMetadata(
  currentRepoRoot: string = repoRoot,
): CargoMetadata {
  const rawMetadata = execFileSync(
    "cargo",
    [
      "metadata",
      "--manifest-path",
      "backend/service/Cargo.toml",
      "--format-version",
      "1",
    ],
    {
      cwd: currentRepoRoot,
      encoding: "utf8",
    },
  );

  return JSON.parse(rawMetadata) as CargoMetadata;
}

function collectForbiddenDependencyFailures(
  crateName: string,
  localDependencies: ReadonlySet<string>,
  forbiddenCrates: ReadonlyArray<string>,
): string[] {
  return forbiddenCrates
    .filter((forbiddenCrate) => localDependencies.has(forbiddenCrate))
    .map(
      (forbiddenCrate) => `${crateName} may not depend on ${forbiddenCrate}.`,
    );
}

export function collectRustWorkspaceFailures(
  metadata: CargoMetadata,
  currentRepoRoot: string = repoRoot,
): string[] {
  const failures: string[] = [];
  const packagesById = new Map(
    metadata.packages.map((pkg) => [pkg.id, pkg] as const),
  );
  const workspaceCratesById = new Map<string, string>();
  const workspaceCrates = new Set<string>();

  for (const memberId of metadata.workspace_members) {
    const workspacePackage = packagesById.get(memberId);

    if (workspacePackage === undefined) {
      failures.push(
        `cargo metadata is missing package details for ${memberId}.`,
      );
      continue;
    }

    const manifestDirectory = dirname(workspacePackage.manifest_path);
    const relativeManifestDirectory = toPortableRelativePath(
      currentRepoRoot,
      manifestDirectory,
    );
    const crateName = basename(manifestDirectory);

    workspaceCratesById.set(memberId, crateName);
    workspaceCrates.add(crateName);

    if (!relativeManifestDirectory.startsWith("backend/service/crates/")) {
      failures.push(
        `Rust workspace member ${workspacePackage.name} sits outside backend/service/crates/: ${relativeManifestDirectory}.`,
      );
      continue;
    }

    if (!approvedCrates.has(crateName)) {
      failures.push(
        `Rust workspace member ${workspacePackage.name} is not an approved crate: ${crateName}.`,
      );
    }
  }

  for (const approvedCrate of approvedCrates) {
    if (!workspaceCrates.has(approvedCrate)) {
      failures.push(
        `Rust workspace is missing approved crate ${approvedCrate}.`,
      );
    }
  }

  const resolveNodes = metadata.resolve?.nodes;

  if (resolveNodes === undefined) {
    failures.push("cargo metadata did not include resolve graph data.");
    return failures;
  }

  const nodesById = new Map(
    resolveNodes.map((node) => [node.id, node] as const),
  );
  const localDependenciesByCrate = new Map<string, Set<string>>();

  for (const memberId of metadata.workspace_members) {
    const crateName = workspaceCratesById.get(memberId);

    if (crateName === undefined) {
      continue;
    }

    const node = nodesById.get(memberId);

    if (node === undefined) {
      failures.push(`cargo metadata is missing resolve node for ${crateName}.`);
      continue;
    }

    const localDependencies = new Set<string>();

    for (const dependencyId of node.dependencies) {
      const dependencyCrate = workspaceCratesById.get(dependencyId);

      if (dependencyCrate !== undefined) {
        localDependencies.add(dependencyCrate);
      }
    }

    localDependenciesByCrate.set(crateName, localDependencies);
  }

  const acpContractsDependencies =
    localDependenciesByCrate.get("acp-contracts") ?? new Set<string>();
  if (acpContractsDependencies.size > 0) {
    failures.push(
      `acp-contracts may not depend on local crates: ${[...acpContractsDependencies].sort().join(", ")}.`,
    );
  }

  for (const [crateName, localDependencies] of localDependenciesByCrate) {
    if (localDependencies.has("service-bin")) {
      failures.push(`${crateName} may not depend on service-bin.`);
    }
  }

  for (const providerCrate of approvedProviderCrates) {
    const localDependencies =
      localDependenciesByCrate.get(providerCrate) ?? new Set<string>();
    const forbiddenCrates = [
      "app-api",
      "session-store",
      ...approvedProviderCrates.filter(
        (otherProviderCrate) => otherProviderCrate !== providerCrate,
      ),
    ];

    failures.push(
      ...collectForbiddenDependencyFailures(
        providerCrate,
        localDependencies,
        forbiddenCrates,
      ),
    );
  }

  const appApiDependencies =
    localDependenciesByCrate.get("app-api") ?? new Set<string>();
  failures.push(
    ...collectForbiddenDependencyFailures(
      "app-api",
      appApiDependencies,
      approvedProviderCrates,
    ),
  );

  const sessionStoreDependencies =
    localDependenciesByCrate.get("session-store") ?? new Set<string>();
  failures.push(
    ...collectForbiddenDependencyFailures(
      "session-store",
      sessionStoreDependencies,
      ["app-api", ...approvedProviderCrates],
    ),
  );

  return failures;
}

export function collectStructureFailures(
  currentRepoRoot: string = repoRoot,
  cargoMetadata: CargoMetadata = loadCargoMetadata(currentRepoRoot),
): string[] {
  const failures: string[] = [];
  const workspaceUnits = new Map<string, WorkspaceUnit>();
  const workspaceUnitsByName = new Map<string, WorkspaceUnit>();
  const topLevelDirectories = visibleDirectories(currentRepoRoot).filter(
    (directoryName) => !ignoredTopLevelDirs.has(directoryName),
  );

  for (const directoryName of topLevelDirectories) {
    if (forbiddenTopLevelDirs.has(directoryName)) {
      failures.push(
        `Forbidden top-level directory ${directoryName} is present.`,
      );
    }

    if (!allowedTopLevelDirs.has(directoryName)) {
      failures.push(
        `Unexpected top-level directory ${directoryName} is present.`,
      );
    }
  }

  for (const directoryName of allowedTopLevelDirs) {
    if (!topLevelDirectories.includes(directoryName)) {
      failures.push(
        `Required top-level directory ${directoryName} is missing.`,
      );
    }
  }

  assertExactChildren(
    resolve(currentRepoRoot, "apps"),
    approvedApps,
    "apps/",
    failures,
  );
  assertExactChildren(
    resolve(currentRepoRoot, "packages"),
    approvedPackages,
    "packages/",
    failures,
  );
  assertExactChildren(
    resolve(currentRepoRoot, "artifacts"),
    approvedArtifactRoots,
    "artifacts/",
    failures,
  );
  assertExactChildren(
    resolve(currentRepoRoot, "vendor"),
    approvedVendorRoots,
    "vendor/",
    failures,
  );
  assertExactChildren(
    resolve(currentRepoRoot, "backend/service/crates"),
    approvedCrates,
    "backend/service/crates/",
    failures,
  );
  assertExactChildren(
    resolve(currentRepoRoot, "backend/service/testdata"),
    approvedTestdataRoots,
    "backend/service/testdata/",
    failures,
  );

  for (const filePath of walkFiles(resolve(currentRepoRoot, "artifacts"))) {
    if (!allowedExtensionFor(filePath, allowedArtifactExtensions)) {
      failures.push(
        `Artifact file ${toPortableRelativePath(currentRepoRoot, filePath)} uses a disallowed extension.`,
      );
    }
  }

  for (const filePath of walkFiles(resolve(currentRepoRoot, "vendor"))) {
    if (!allowedExtensionFor(filePath, allowedVendorExtensions)) {
      failures.push(
        `Vendor file ${toPortableRelativePath(currentRepoRoot, filePath)} uses a disallowed extension.`,
      );
    }
  }

  for (const appName of approvedApps) {
    const workspaceUnit = readWorkspaceUnit("app", `apps/${appName}`);
    workspaceUnits.set(`apps/${appName}`, workspaceUnit);
    workspaceUnitsByName.set(workspaceUnit.manifest.name, workspaceUnit);
  }

  for (const packageName of approvedPackages) {
    const workspaceUnit = readWorkspaceUnit(
      "package",
      `packages/${packageName}`,
    );
    workspaceUnits.set(`packages/${packageName}`, workspaceUnit);
    workspaceUnitsByName.set(workspaceUnit.manifest.name, workspaceUnit);
  }

  checkWorkspaceImports(workspaceUnits, workspaceUnitsByName, failures);
  failures.push(
    ...collectRustWorkspaceFailures(cargoMetadata, currentRepoRoot),
  );

  return failures;
}

function main(): void {
  const failures = collectStructureFailures();

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }

    process.exit(1);
  }

  console.log("Structure checks passed.");
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
