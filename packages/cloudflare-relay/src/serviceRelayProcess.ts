import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

interface RelayServiceRun {
  readonly home: string;
  readonly port: number;
  readonly service: ChildProcessWithoutNullStreams;
}

async function startRelayServiceRun(
  relayEndpoint: string,
): Promise<RelayServiceRun> {
  const port = await freePort();
  const home = await mkdtemp(join(tmpdir(), "conduit-service-relay-e2e-"));
  return {
    home,
    port,
    service: startService(home, port, relayEndpoint),
  };
}

async function stopRelayServiceRun(run: RelayServiceRun | null): Promise<void> {
  run?.service.kill();
  if (run !== null) {
    await rm(run.home, { force: true, recursive: true });
  }
}

function startService(
  home: string,
  port: number,
  relayEndpoint: string,
): ChildProcessWithoutNullStreams {
  const child = spawn(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "backend/service/Cargo.toml",
      "-p",
      "service-bin",
      "--",
      "serve",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--app-base-url",
      "https://expo.test/app",
    ],
    {
      cwd: repoRoot,
      env: Object.assign({}, process.env, {
        CONDUIT_HOME: home,
        CONDUIT_RELAY_ENDPOINT: relayEndpoint,
      }),
    },
  );
  return child;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        reject(new Error("free port was unavailable"));
        return;
      }
      server.close(() => {
        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

export { startRelayServiceRun, stopRelayServiceRun };
export type { RelayServiceRun };
