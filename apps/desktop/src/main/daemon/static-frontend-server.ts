import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { DesktopDaemonConfig } from "./types.js";

type StaticFrontendConfig = Extract<
  DesktopDaemonConfig["frontend"],
  { readonly kind: "static" }
>;

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

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
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

function resolveAssetPath(webDir: string, pathname: string): string | null {
  const requestedPath = resolve(webDir, `.${decodeURIComponent(pathname)}`);
  if (!isPathInside(webDir, requestedPath)) {
    return null;
  }
  const candidate = filePathForRequest(requestedPath);
  if (candidate !== null) {
    return candidate;
  }
  if (extname(requestedPath) === "") {
    return directoryIndexPath(webDir);
  }
  return null;
}

function injectRuntimeConfig(
  desktopConfig: DesktopDaemonConfig,
  html: string,
): string {
  const runtimeConfig = {
    clientLogUrl: `http://${desktopConfig.backendHost}:${String(desktopConfig.backendPort)}/api/client-log`,
    logProfile: desktopConfig.logProfile,
    sessionWsUrl: `ws://${desktopConfig.backendHost}:${String(desktopConfig.backendPort)}/api/session`,
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

function writeAssetResponse(request: {
  readonly assetPath: string;
  readonly desktopConfig: DesktopDaemonConfig;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}): void {
  request.response.writeHead(200, {
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": contentType(request.assetPath),
    expires: "0",
    pragma: "no-cache",
  });
  if (request.request.method === "HEAD") {
    request.response.end();
    return;
  }
  if (extname(request.assetPath) === ".html") {
    request.response.end(
      injectRuntimeConfig(
        request.desktopConfig,
        readFileSync(request.assetPath, "utf8"),
      ),
    );
    return;
  }
  createReadStream(request.assetPath).pipe(request.response);
}

interface StaticFrontendRequest {
  readonly config: StaticFrontendConfig;
  readonly desktopConfig: DesktopDaemonConfig;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}

function finishEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode);
  response.end();
}

function finishFavicon(response: ServerResponse): void {
  response.writeHead(204, { "content-length": "0" });
  response.end();
}

function rejectDisallowedMethod(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  const methodAllowed = request.method === "GET" || request.method === "HEAD";
  if (methodAllowed) {
    return false;
  }
  finishEmpty(response, 405);
  return true;
}

function serveFavicon(pathname: string, response: ServerResponse): boolean {
  if (pathname !== "/favicon.ico") {
    return false;
  }
  finishFavicon(response);
  return true;
}

function resolvedRequestPath(
  config: StaticFrontendConfig,
  request: IncomingMessage,
): string {
  const requestUrl = new URL(request.url ?? "/", `http://${config.webHost}`);
  return requestUrl.pathname;
}

function serveStaticFrontend({
  config,
  desktopConfig,
  request,
  response,
}: StaticFrontendRequest): void {
  if (rejectDisallowedMethod(request, response)) {
    return;
  }
  const pathname = resolvedRequestPath(config, request);
  if (serveFavicon(pathname, response)) {
    return;
  }
  const assetPath = resolveAssetPath(config.webDir, pathname);
  if (assetPath === null) {
    finishEmpty(response, 404);
    return;
  }
  writeAssetResponse({ assetPath, desktopConfig, request, response });
}

async function startStaticFrontendServer(
  desktopConfig: DesktopDaemonConfig,
): Promise<Server | null> {
  const config = desktopConfig.frontend;
  if (config.kind !== "static") {
    return null;
  }
  const deferred = Promise.withResolvers<Server>();
  const server = createServer((request, response) => {
    serveStaticFrontend({ config, desktopConfig, request, response });
  });
  server.once("error", deferred.reject);
  server.listen(config.webPort, config.webHost, () => {
    server.off("error", deferred.reject);
    deferred.resolve(server);
  });
  const serverResult = await deferred.promise;
  return serverResult;
}

async function closeStaticFrontendServer(server: Server | null): Promise<void> {
  if (server === null) {
    return;
  }
  const deferred = Promise.withResolvers<null>();
  let closed = false;
  const finish = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    deferred.resolve(null);
  };
  const closeTimer = setTimeout(finish, 1000);
  closeTimer.unref();
  server.close(() => {
    clearTimeout(closeTimer);
    finish();
  });
  server.closeAllConnections();
  await deferred.promise;
}

function frontendUrl(config: DesktopDaemonConfig): string {
  if (config.frontend.kind === "url") {
    return config.frontend.url;
  }
  return `http://${config.frontend.webHost}:${String(config.frontend.webPort)}/`;
}

export { closeStaticFrontendServer, frontendUrl, startStaticFrontendServer };
