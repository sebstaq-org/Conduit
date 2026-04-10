import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DesktopAction,
  DesktopProofConfig,
  DesktopProofRequest,
  DesktopProofResult,
} from "@conduit/app-client";
import type {
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/app-core";

import { createDesktopProofConfig } from "./proof-config.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const distRoot = dirname(fileURLToPath(import.meta.url));
const clientJsPath = join(distRoot, "client.js");
const lastSessionIds = new Map<ProviderId, string>();

createServer((request, response) => {
  void route(request, response);
}).listen(4173, "127.0.0.1");

async function route(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET" && request.url === "/client.js") {
    const body = await readFile(clientJsPath, "utf8");
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
    });
    response.end(body);
    return;
  }
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html());
    return;
  }
  if (request.method === "GET" && request.url === "/api/config") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(desktopProofConfig()));
    return;
  }
  if (request.method === "POST" && request.url === "/api/run") {
    try {
      const payload = await readJson<DesktopProofRequest>(request);
      const result = await execute(payload);
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return;
  }
  response.writeHead(404);
  response.end();
}

async function execute(
  request: DesktopProofRequest,
): Promise<DesktopProofResult> {
  const artifactRoot = artifactRootFor(request.provider, request.action);
  const args = scenarioArgs(request, artifactRoot);
  await runSilentScenario(args);
  const snapshot = normalizeSnapshot(
    await readJsonFile<Record<string, unknown>>(
      join(artifactRoot, "snapshot.json"),
    ),
  );
  const requests = await readJsonl(join(artifactRoot, "requests.jsonl"));
  const responses = await readJsonl(join(artifactRoot, "responses.jsonl"));
  const events = normalizeEvents(
    await readJsonl(join(artifactRoot, "events.jsonl")),
  );
  const summary = await readFile(join(artifactRoot, "summary.md"), "utf8");
  const lastSessionId = extractLastSessionId(snapshot);
  if (lastSessionId) {
    lastSessionIds.set(request.provider, lastSessionId);
  }
  const result = {
    provider: request.provider,
    action: request.action,
    artifactRoot,
    desktopProofPng: join(artifactRoot, "desktop-proof.png"),
    snapshot,
    requests,
    responses,
    events,
    summary,
    lastSessionId,
  };
  await captureDesktopProof(result);
  return result;
}

function desktopProofConfig(): DesktopProofConfig {
  return createDesktopProofConfig(repoRoot);
}

function scenarioArgs(
  request: DesktopProofRequest,
  artifactRoot: string,
): string[] {
  const provider = request.provider;
  const cwd = request.cwd;
  switch (request.action) {
    case "connect":
      return [
        "initialize",
        "--provider",
        provider,
        "--artifact-root",
        artifactRoot,
      ];
    case "new":
      return [
        "session-new",
        "--provider",
        provider,
        "--cwd",
        cwd,
        "--artifact-root",
        artifactRoot,
      ];
    case "list":
      return [
        "session-list",
        "--provider",
        provider,
        "--artifact-root",
        artifactRoot,
      ];
    case "load":
      return [
        "session-load",
        "--provider",
        provider,
        "--cwd",
        cwd,
        "--session-id",
        requiredSessionId(provider),
        "--artifact-root",
        artifactRoot,
      ];
    case "prompt":
      return [
        "session-prompt",
        "--provider",
        provider,
        "--cwd",
        cwd,
        "--prompt",
        request.prompt ?? "Reply with exactly OK.",
        "--artifact-root",
        artifactRoot,
      ];
    case "cancel":
      return [
        "session-cancel",
        "--provider",
        provider,
        "--cwd",
        cwd,
        "--prompt",
        request.prompt ?? "Count slowly from 1 to 10000.",
        "--cancel-after-ms",
        String(request.cancelAfterMs ?? 500),
        "--artifact-root",
        artifactRoot,
      ];
  }
}

function artifactRootFor(provider: ProviderId, action: DesktopAction): string {
  const suffix = {
    connect: "initialize",
    new: "session-new",
    list: "session-list",
    load: "session-load",
    prompt: "session-prompt",
    cancel: "session-cancel",
  }[action];
  return join(repoRoot, "artifacts/manual/phase-1", provider, suffix);
}

function requiredSessionId(provider: ProviderId): string {
  const sessionId = lastSessionIds.get(provider);
  if (!sessionId) {
    throw new Error(`no session id cached for ${provider}`);
  }
  return sessionId;
}

function runSilentScenario(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "rtk",
      [
        "cargo",
        "run",
        "--quiet",
        "--locked",
        "--manifest-path",
        "backend/service/Cargo.toml",
        "-p",
        "service-bin",
        "--",
        ...args,
      ],
      {
        cwd: repoRoot,
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr || `scenario failed with exit code ${String(code ?? "null")}`,
        ),
      );
    });
  });
}

async function captureDesktopProof(result: DesktopProofResult): Promise<void> {
  const htmlPath = join(result.artifactRoot, "desktop-proof.html");
  await writeFile(htmlPath, desktopProofHtml(result), "utf8");
  await runChromiumScreenshot(htmlPath, result.desktopProofPng);
}

async function runChromiumScreenshot(
  htmlPath: string,
  screenshotPath: string,
): Promise<void> {
  const scratchRoot = await mkdtemp(join(homedir(), "conduit-desktop-proof-"));
  const scratchHtml = join(scratchRoot, "desktop-proof.html");
  const scratchPng = join(scratchRoot, "desktop-proof.png");
  try {
    await copyFile(htmlPath, scratchHtml);
    await spawnChromiumScreenshot(scratchHtml, scratchPng);
    await copyFile(scratchPng, screenshotPath);
  } finally {
    await rm(scratchRoot, { recursive: true, force: true });
  }
}

function spawnChromiumScreenshot(
  htmlPath: string,
  screenshotPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chromium = process.env.CONDUIT_CHROMIUM_BIN ?? "chromium";
    const child = spawn(chromium, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--window-size=1440,1100",
      `--screenshot=${screenshotPath}`,
      `file://${htmlPath}`,
    ]);
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr ||
            `desktop screenshot capture failed with exit code ${String(code ?? "null")}`,
        ),
      );
    });
  });
}

function desktopProofHtml(result: DesktopProofResult): string {
  const snapshot = escapeHtml(JSON.stringify(result.snapshot, null, 2));
  const events = escapeHtml(JSON.stringify(result.events, null, 2));
  const requests = escapeHtml(JSON.stringify(result.requests, null, 2));
  const responses = escapeHtml(JSON.stringify(result.responses, null, 2));
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Conduit desktop proof artifact</title>
      <style>
        body { font-family: "Iosevka", "JetBrains Mono", monospace; margin: 0; background: linear-gradient(180deg, #f5f0e8, #e7efe6); color: #1f2a22; }
        main { max-width: 1200px; margin: 0 auto; padding: 24px; }
        section { background: rgba(255,255,255,0.72); border: 1px solid rgba(31,42,34,0.15); border-radius: 16px; margin: 16px 0; padding: 16px; }
        pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      </style>
    </head>
    <body>
      <main>
        <h1>Conduit desktop ACP proof</h1>
        <p>Provider: <strong>${escapeHtml(result.provider)}</strong></p>
        <p>Action: <strong>${escapeHtml(result.action)}</strong></p>
        <p>Artifacts: <code>${escapeHtml(result.artifactRoot)}</code></p>
        <section><h2>Summary</h2><pre>${escapeHtml(result.summary)}</pre></section>
        <section><h2>Snapshot</h2><pre>${snapshot}</pre></section>
        <section><h2>Requests</h2><pre>${requests}</pre></section>
        <section><h2>Responses</h2><pre>${responses}</pre></section>
        <section><h2>Raw Wire Events</h2><pre>${events}</pre></section>
      </main>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readJson<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    request.on("error", reject);
  });
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readJsonl(path: string): Promise<unknown[]> {
  const body = await readFile(path, "utf8");
  return body
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function extractLastSessionId(snapshot: ProviderSnapshot): string | null {
  if (snapshot.lastPrompt) {
    return snapshot.lastPrompt.identity.acpSessionId;
  }
  const last = snapshot.liveSessions.at(-1);
  return last ? last.identity.acpSessionId : null;
}

function normalizeSnapshot(raw: Record<string, unknown>): ProviderSnapshot {
  const liveSessions = Array.isArray(raw.live_sessions)
    ? raw.live_sessions.map((entry) => {
        const value = entry as Record<string, unknown>;
        const identity = value.identity as Record<string, unknown>;
        return {
          identity: {
            provider: identity.provider as ProviderId,
            acpSessionId: String(identity.acp_session_id),
          },
          cwd: readString(value.cwd),
          title: (value.title as string | null | undefined) ?? null,
          observedVia: readString(value.observed_via),
        };
      })
    : [];
  const lastPrompt = raw.last_prompt
    ? normalizePrompt(raw.last_prompt as Record<string, unknown>)
    : null;
  return {
    provider: raw.provider as ProviderId,
    connectionState:
      raw.connection_state as ProviderSnapshot["connectionState"],
    discovery: raw.discovery ?? null,
    capabilities: raw.capabilities ?? null,
    authMethods: Array.isArray(raw.auth_methods) ? raw.auth_methods : [],
    liveSessions,
    lastPrompt,
  };
}

function normalizePrompt(
  raw: Record<string, unknown>,
): NonNullable<ProviderSnapshot["lastPrompt"]> {
  const identity = raw.identity as Record<string, unknown>;
  return {
    identity: {
      provider: identity.provider as ProviderId,
      acpSessionId: String(identity.acp_session_id),
    },
    state: raw.state as NonNullable<ProviderSnapshot["lastPrompt"]>["state"],
    stopReason: (raw.stop_reason as string | null | undefined) ?? null,
    rawUpdateCount: Number(raw.raw_update_count ?? 0),
  };
}

function normalizeEvents(rawEvents: unknown[]): RawWireEvent[] {
  return rawEvents.map((entry) => {
    const raw = entry as Record<string, unknown>;
    return {
      sequence: Number(raw.sequence ?? 0),
      stream: raw.stream as RawWireEvent["stream"],
      kind: raw.kind as RawWireEvent["kind"],
      payload: readString(raw.payload),
      method: (raw.method as string | null | undefined) ?? null,
      requestId: (raw.request_id as string | null | undefined) ?? null,
      json: raw.json ?? null,
    };
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function html(): string {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Conduit desktop ACP proof</title>
      <style>
        body { font-family: "Iosevka", "JetBrains Mono", monospace; margin: 0; background: linear-gradient(180deg, #f5f0e8, #e7efe6); color: #1f2a22; }
        .shell { max-width: 1200px; margin: 0 auto; padding: 24px; }
        .controls, .status, .grid article { background: rgba(255,255,255,0.7); border: 1px solid rgba(31,42,34,0.15); border-radius: 16px; padding: 16px; }
        .controls { display: grid; gap: 12px; }
        .buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
        .grid .full { grid-column: 1 / -1; }
        input, textarea, select, button { width: 100%; font: inherit; }
        textarea { min-height: 88px; }
        button { width: auto; padding: 8px 12px; cursor: pointer; background: #16331e; color: #f5f0e8; border: 0; border-radius: 999px; }
        pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      </style>
    </head>
    <body>
      <script type="module" src="/client.js"></script>
    </body>
  </html>`;
}
