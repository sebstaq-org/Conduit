import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  desktopStaticScheme,
  frontendUrl,
  resolveStaticAsset,
  staticFrontendResponse,
} from "./static-frontend-protocol.js";
import type { DesktopDaemonConfig } from "./types.js";

let roots: string[] = [];

function staticConfig(webDir: string): DesktopDaemonConfig {
  return {
    appBaseUrl: "conduit://pair",
    backendHost: "127.0.0.1",
    backendLogPath: join(webDir, "backend.log"),
    backendPidPath: null,
    backendPort: 4274,
    frontend: {
      kind: "static",
      webDir,
    },
    home: join(webDir, "home"),
    logProfile: "stage",
    providerFixtures: null,
    relayEndpoint: "https://relay.example.test",
    serviceBinPath: "/repo/service-bin",
    sentryDsn: "https://public@example.com/1",
    storePath: null,
  };
}

async function webRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "conduit-static-web-"));
  roots.push(root);
  await writeFile(
    join(root, "index.html"),
    "<html><head></head><body>stage</body></html>",
    "utf8",
  );
  await writeFile(join(root, "asset.js"), "console.log('ok');", "utf8");
  return root;
}

describe("desktop static frontend protocol", () => {
  afterEach(async () => {
    await Promise.all(
      roots.map(async (root) => {
        await rm(root, { force: true, recursive: true });
      }),
    );
    roots = [];
  });

  it("serves html with runtime config through the Electron protocol URL", async () => {
    const root = await webRoot();
    const config = staticConfig(root);
    const response = await staticFrontendResponse(
      config,
      new Request(`${frontendUrl(config)}sessions`),
    );

    expect(frontendUrl(config)).toBe(`${desktopStaticScheme}://desktop/`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("globalThis.CONDUIT_RUNTIME_CONFIG");
    expect(text).toContain('"runtimeSurface":"desktop_app"');
    expect(text).toContain('"sentryDsn":"https://public@example.com/1"');
    expect(text).toContain("ws://127.0.0.1:4274/api/session");
  });

  it("serves assets without allowing path traversal", async () => {
    const root = await webRoot();
    const allowed = await resolveStaticAsset(root, "/asset.js");
    const traversal = await resolveStaticAsset(root, "/../secret.txt");

    expect(allowed?.path).toBe(join(root, "asset.js"));
    expect(traversal).toBeNull();
  });

  it("returns 404 for missing static assets", async () => {
    const root = await webRoot();
    const response = await staticFrontendResponse(
      staticConfig(root),
      new Request(`${desktopStaticScheme}://desktop/missing.js`),
    );

    expect(response.status).toBe(404);
  });
});
