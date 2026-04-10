import { describe, expect, it } from "vitest";

import {
  type CargoMetadata,
  collectRustWorkspaceFailures,
} from "./check-structure.js";

const repoRoot = "/repo";
const approvedCrates = [
  "acp-contracts",
  "acp-core",
  "acp-discovery",
  "app-api",
  "provider-claude",
  "provider-codex",
  "provider-copilot",
  "service-bin",
  "session-store",
] as const;

function createValidMetadata(): CargoMetadata {
  const localDependenciesByCrate: Readonly<
    Record<(typeof approvedCrates)[number], readonly string[]>
  > = {
    "acp-contracts": [],
    "acp-core": [],
    "acp-discovery": [],
    "app-api": ["acp-contracts", "acp-core"],
    "provider-claude": [],
    "provider-codex": [],
    "provider-copilot": [],
    "service-bin": [
      "acp-discovery",
      "app-api",
      "provider-claude",
      "provider-codex",
      "provider-copilot",
      "session-store",
    ],
    "session-store": [],
  };

  return {
    packages: approvedCrates.map((crateName) => ({
      id: crateName,
      manifest_path: `${repoRoot}/backend/service/crates/${crateName}/Cargo.toml`,
      name: crateName,
    })),
    resolve: {
      nodes: approvedCrates.map((crateName) => ({
        id: crateName,
        dependencies: [...localDependenciesByCrate[crateName]],
      })),
    },
    workspace_members: [...approvedCrates],
  };
}

function resolveNode(metadata: CargoMetadata, crateName: string) {
  const node = metadata.resolve?.nodes.find((entry) => entry.id === crateName);

  if (node === undefined) {
    throw new Error(`Missing node for ${crateName}.`);
  }

  return node;
}

describe("collectRustWorkspaceFailures", () => {
  it("accepts the approved crate graph", () => {
    expect(
      collectRustWorkspaceFailures(createValidMetadata(), repoRoot),
    ).toEqual([]);
  });

  it("rejects forbidden provider dependencies", () => {
    const metadata = createValidMetadata();
    const providerCodexNode = resolveNode(metadata, "provider-codex");

    providerCodexNode.dependencies.push("provider-claude");

    expect(collectRustWorkspaceFailures(metadata, repoRoot)).toContain(
      "provider-codex may not depend on provider-claude.",
    );
  });

  it("rejects workspace members outside the approved crate tree", () => {
    const metadata = createValidMetadata();

    metadata.packages.push({
      id: "rogue",
      manifest_path: `${repoRoot}/backend/service/tools/rogue/Cargo.toml`,
      name: "rogue-tool",
    });
    metadata.workspace_members.push("rogue");
    const resolveGraph = metadata.resolve;

    if (resolveGraph === undefined) {
      throw new Error("Missing resolve graph.");
    }

    resolveGraph.nodes.push({
      id: "rogue",
      dependencies: [],
    });

    const failures = collectRustWorkspaceFailures(metadata, repoRoot);

    expect(
      failures.some((failure) =>
        failure.includes("rogue-tool sits outside backend/service/crates/"),
      ),
    ).toBe(true);
  });
});
