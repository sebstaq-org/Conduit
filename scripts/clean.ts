import { readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const removableDirectories = [
  "backend/service/target",
  "artifacts/manual",
  "artifacts/automated",
];

for (const relativePath of removableDirectories) {
  const absolutePath = join(repoRoot, relativePath);
  if (relativePath.startsWith("artifacts/")) {
    for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
      if (entry.name === ".gitkeep") {
        continue;
      }

      rmSync(join(absolutePath, entry.name), { force: true, recursive: true });
    }
    continue;
  }

  rmSync(absolutePath, { force: true, recursive: true });
}

for (const workspaceRoot of ["apps", "packages"]) {
  for (const entry of readdirSync(join(repoRoot, workspaceRoot), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }

    rmSync(join(repoRoot, workspaceRoot, entry.name, "dist"), {
      force: true,
      recursive: true,
    });
    rmSync(join(repoRoot, workspaceRoot, entry.name, "tsconfig.tsbuildinfo"), {
      force: true,
    });
  }
}
