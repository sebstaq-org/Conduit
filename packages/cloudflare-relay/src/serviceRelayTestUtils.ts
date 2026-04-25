import { expect } from "vitest";
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildRelayWebSocketProtocol,
  buildRelayWebSocketUrl,
  deriveRelayConnectionId,
} from "@conduit/relay-transport";
import type { ConnectionOfferV1 } from "@conduit/app-client";

async function openRawRelayClientSocket(
  relayEndpoint: string,
  offer: ConnectionOfferV1,
): Promise<WebSocket> {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  const socket = new WebSocket(
    buildRelayWebSocketUrl(relayEndpoint, {
      capability: offer.relay.clientCapability,
      connectionId,
      role: "client",
      serverId: offer.relay.serverId,
    }),
    [buildRelayWebSocketProtocol(offer.relay.clientCapability)],
  );
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener(
      "open",
      () => {
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        reject(new Error("raw relay client websocket failed to open"));
      },
      { once: true },
    );
  });
  return socket;
}

async function waitForRelayDataSocket(
  relayEndpoint: string,
  relayAdminToken: string,
  offer: ConnectionOfferV1,
): Promise<void> {
  await expect
    .poll(
      () => fetchRelayDataSocketCount(relayEndpoint, relayAdminToken, offer),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
}

async function fetchRelayDataSocketCount(
  relayEndpoint: string,
  relayAdminToken: string,
  offer: ConnectionOfferV1,
): Promise<number> {
  const url = new URL(`${relayEndpoint}/__conduit_test/snapshot`);
  url.searchParams.set("serverId", offer.relay.serverId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `relay snapshot failed with ${response.status}: ${await response.text()}`,
    );
  }
  const snapshot = (await response.json()) as { dataSocketCount?: unknown };
  if (typeof snapshot.dataSocketCount !== "number") {
    throw new TypeError("relay snapshot did not include dataSocketCount");
  }
  return snapshot.dataSocketCount;
}

function expectNoMessage(socket: WebSocket, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onMessage = (): void => {
      cleanup();
      reject(new Error("expired relay handshake unexpectedly received data"));
    };
    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
    };
    socket.addEventListener("message", onMessage);
  });
}

async function closeRelayDataSocket(
  relayEndpoint: string,
  relayAdminToken: string,
  offer: ConnectionOfferV1,
): Promise<void> {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  const url = new URL(`${relayEndpoint}/__conduit_test/close-data`);
  url.searchParams.set("serverId", offer.relay.serverId);
  url.searchParams.set("connectionId", connectionId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `close-data failed with ${response.status}: ${await response.text()}`,
    );
  }
}

async function expireStoredOffer(
  home: string,
  offer: ConnectionOfferV1,
): Promise<void> {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  const path = join(home, "relay-offers", `${connectionId}.json`);
  const stored = JSON.parse(await readFile(path, "utf8")) as Record<
    string,
    unknown
  >;
  stored.expiresAt = "2026-04-18T00:00:00Z";
  await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`);
}

function capturingWebSocket(captured: WebSocket[]): typeof WebSocket {
  return class CapturingWebSocket extends WebSocket {
    public constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      captured.push(this);
    }
  };
}

async function closeCapturedSockets(
  captured: readonly WebSocket[],
): Promise<void> {
  await Promise.all(captured.map((socket) => closeSocket(socket)));
}

function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    socket.addEventListener(
      "close",
      () => {
        resolve();
      },
      { once: true },
    );
    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close();
    }
  });
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(100);
    }
  }
  throw new Error("service-bin did not become healthy");
}

async function bundleWorkerScript(scriptPath: string): Promise<string> {
  const result = await build({
    bundle: true,
    entryPoints: [scriptPath],
    format: "esm",
    platform: "browser",
    write: false,
  });
  const output = result.outputFiles[0]?.text;
  if (output === undefined) {
    throw new Error("cloudflare relay worker bundle was not produced");
  }
  return output;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export {
  bundleWorkerScript,
  capturingWebSocket,
  closeCapturedSockets,
  closeRelayDataSocket,
  delay,
  expectNoMessage,
  expireStoredOffer,
  openRawRelayClientSocket,
  waitForHealth,
  waitForRelayDataSocket,
};
