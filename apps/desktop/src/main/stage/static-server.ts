import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { StageRuntimeConfig } from "./types.js";

interface RuntimeConfigScript {
  readonly clientLogUrl: string;
  readonly logProfile: "stage";
  readonly sessionWsUrl: string;
}

interface AssetResponseRequest {
  readonly assetPath: string;
  readonly config: StageRuntimeConfig;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}

interface ResolveAssetRequest {
  readonly config: StageRuntimeConfig;
  readonly pathname: string;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}

function isHtmlAsset(path: string): boolean {
  return extname(path) === ".html";
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
}

function injectRuntimeConfig(config: StageRuntimeConfig, html: string): string {
  const runtimeConfig: RuntimeConfigScript = {
    clientLogUrl: `http://${config.backendHost}:${String(config.backendPort)}/api/client-log`,
    logProfile: "stage",
    sessionWsUrl: `ws://${config.backendHost}:${String(config.backendPort)}/api/session`,
  };
  const serializedConfig = JSON.stringify(runtimeConfig).replaceAll(
    "<",
    String.raw`\u003c`,
  );
  const script = `<script>globalThis.CONDUIT_RUNTIME_CONFIG=${serializedConfig};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  return `${script}${html}`;
}

function contentType(path: string): string {
  const extension = extname(path);
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
  };
  return contentTypes[extension] ?? "application/octet-stream";
}

function readableFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function directoryIndexPath(path: string): string | null {
  const indexPath = join(path, "index.html");
  if (readableFile(indexPath)) {
    return indexPath;
  }
  return null;
}

function filePathForRequest(requestedPath: string): string | null {
  try {
    const requestedStat = statSync(requestedPath);
    if (requestedStat.isFile()) {
      return requestedPath;
    }
    if (requestedStat.isDirectory()) {
      return directoryIndexPath(requestedPath);
    }
    return null;
  } catch {
    return null;
  }
}

function fallbackIndexPath(
  webDir: string,
  requestedPath: string,
): string | null {
  if (extname(requestedPath) !== "") {
    return null;
  }
  return directoryIndexPath(webDir);
}

function resolveAssetPath(webDir: string, pathname: string): string | null {
  const requestedPath = resolve(webDir, `.${decodeURIComponent(pathname)}`);
  if (!isPathInside(webDir, requestedPath)) {
    return null;
  }
  const candidate = filePathForRequest(requestedPath);
  if (candidate !== null) {
    return candidate;
  }
  return fallbackIndexPath(webDir, requestedPath);
}

function writeAssetResponse(assetRequest: AssetResponseRequest): void {
  assetRequest.response.writeHead(200, {
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": contentType(assetRequest.assetPath),
    expires: "0",
    pragma: "no-cache",
  });
  if (assetRequest.request.method === "HEAD") {
    assetRequest.response.end();
    return;
  }
  if (isHtmlAsset(assetRequest.assetPath)) {
    assetRequest.response.end(
      injectRuntimeConfig(
        assetRequest.config,
        readFileSync(assetRequest.assetPath, "utf8"),
      ),
    );
    return;
  }
  createReadStream(assetRequest.assetPath).pipe(assetRequest.response);
}

function finishEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode);
  response.end();
}

function finishFavicon(response: ServerResponse): void {
  response.writeHead(204, { "content-length": "0" });
  response.end();
}

function serveResolvedAsset(assetRequest: ResolveAssetRequest): void {
  const resolvedAssetPath = resolveAssetPath(
    assetRequest.config.webDir,
    assetRequest.pathname,
  );
  if (resolvedAssetPath === null) {
    finishEmpty(assetRequest.response, 404);
    return;
  }
  writeAssetResponse({
    assetPath: resolvedAssetPath,
    config: assetRequest.config,
    request: assetRequest.request,
    response: assetRequest.response,
  });
}

function normalizeUnknownError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function serveStageAsset(
  config: StageRuntimeConfig,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (request.method !== "GET" && request.method !== "HEAD") {
    finishEmpty(response, 405);
    return;
  }
  const requestUrl = new URL(request.url ?? "/", `http://${config.webHost}`);
  if (requestUrl.pathname === "/favicon.ico") {
    finishFavicon(response);
    return;
  }
  serveResolvedAsset({
    config,
    pathname: requestUrl.pathname,
    request,
    response,
  });
}

function startStaticServer(
  config: StageRuntimeConfig,
  onReady: (server: Server) => void,
  onError: (error: Error) => void,
): void {
  const server = createServer((request, response) => {
    try {
      serveStageAsset(config, request, response);
    } catch (error: unknown) {
      onError(normalizeUnknownError(error));
      finishEmpty(response, 500);
    }
  });
  server.once("error", onError);
  server.listen(config.webPort, config.webHost, () => {
    server.off("error", onError);
    onReady(server);
  });
}

function closeStaticServer(server: Server | null, onClosed: () => void): void {
  if (server === null) {
    onClosed();
    return;
  }
  server.close(() => {
    onClosed();
  });
}

export { closeStaticServer, injectRuntimeConfig, startStaticServer };
