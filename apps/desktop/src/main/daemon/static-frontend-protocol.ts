import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DesktopDaemonConfig } from "./types.js";

const desktopStaticScheme = "conduit-desktop";
const desktopStaticOrigin = `${desktopStaticScheme}://desktop`;

interface ResolvedStaticAsset {
  readonly contentType: string;
  readonly path: string;
}

interface StaticRequestParts {
  readonly method: string;
  readonly pathname: string;
}

interface StaticProtocolRegistry {
  handle(
    scheme: string,
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
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

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
}

function runtimeConfig(config: DesktopDaemonConfig): Record<string, string> {
  return {
    clientLogUrl: `http://${config.backendHost}:${String(config.backendPort)}/api/client-log`,
    logProfile: config.logProfile,
    sessionWsUrl: `ws://${config.backendHost}:${String(config.backendPort)}/api/session`,
  };
}

function injectRuntimeConfig(
  desktopConfig: DesktopDaemonConfig,
  html: string,
): string {
  const serializedConfig = JSON.stringify(
    runtimeConfig(desktopConfig),
  ).replaceAll("<", String.raw`\u003c`);
  const script = `<script>globalThis.CONDUIT_RUNTIME_CONFIG=${serializedConfig};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  return `${script}${html}`;
}

async function readableFile(path: string): Promise<boolean> {
  try {
    const pathStat = await stat(path);
    return pathStat.isFile();
  } catch {
    return false;
  }
}

async function directoryIndexPath(path: string): Promise<string | null> {
  const indexPath = join(path, "index.html");
  if (await readableFile(indexPath)) {
    return indexPath;
  }
  return null;
}

async function filePathForRequest(
  requestedPath: string,
): Promise<string | null> {
  try {
    const requestedStat = await stat(requestedPath);
    if (requestedStat.isFile()) {
      return requestedPath;
    }
    if (requestedStat.isDirectory()) {
      return await directoryIndexPath(requestedPath);
    }
    return null;
  } catch {
    return null;
  }
}

function decodedRequestPathname(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function resolvedRequestPath(webDir: string, pathname: string): string | null {
  const decodedPathname = decodedRequestPathname(pathname);
  if (decodedPathname === null) {
    return null;
  }
  const root = resolve(webDir);
  const requestedPath = resolve(root, `.${decodedPathname}`);
  if (!isPathInside(root, requestedPath)) {
    return null;
  }
  return requestedPath;
}

function assetForPath(path: string): ResolvedStaticAsset {
  return { contentType: contentType(path), path };
}

async function fallbackIndexAsset(
  root: string,
  requestedPath: string,
): Promise<ResolvedStaticAsset | null> {
  if (extname(requestedPath) !== "") {
    return null;
  }
  const indexPath = await directoryIndexPath(root);
  if (indexPath === null) {
    return null;
  }
  return assetForPath(indexPath);
}

async function resolveStaticAsset(
  webDir: string,
  pathname: string,
): Promise<ResolvedStaticAsset | null> {
  const root = resolve(webDir);
  const requestedPath = resolvedRequestPath(root, pathname);
  if (requestedPath === null) {
    return null;
  }
  const candidate = await filePathForRequest(requestedPath);
  if (candidate !== null) {
    return assetForPath(candidate);
  }
  return fallbackIndexAsset(root, requestedPath);
}

function noStoreHeaders(contentTypeValue: string): Headers {
  return new Headers({
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": contentTypeValue,
    expires: "0",
    pragma: "no-cache",
  });
}

function methodAllowed(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function faviconResponse(pathname: string): Response | null {
  if (pathname !== "/favicon.ico") {
    return null;
  }
  return new Response(null, {
    headers: new Headers({ "content-length": "0" }),
    status: 204,
  });
}

async function assetResponse(
  config: DesktopDaemonConfig,
  asset: ResolvedStaticAsset,
  method: string,
): Promise<Response> {
  const headers = noStoreHeaders(asset.contentType);
  if (method === "HEAD") {
    return new Response(null, { headers, status: 200 });
  }
  if (extname(asset.path) === ".html") {
    return new Response(
      injectRuntimeConfig(config, await readFile(asset.path, "utf8")),
      { headers },
    );
  }
  return new Response(new Uint8Array(await readFile(asset.path)), { headers });
}

async function staticAssetOrResponse(
  webDir: string,
  pathname: string,
): Promise<ResolvedStaticAsset | Response> {
  const asset = await resolveStaticAsset(webDir, pathname);
  if (asset === null) {
    return new Response(null, { status: 404 });
  }
  return asset;
}

function staticConfigOrResponse(
  config: DesktopDaemonConfig,
): { readonly webDir: string } | Response {
  if (config.frontend.kind !== "static") {
    return new Response("static frontend is not configured", { status: 404 });
  }
  return config.frontend;
}

function earlyStaticResponse(
  request: Request,
  pathname: string,
): Response | null {
  if (!methodAllowed(request.method)) {
    return new Response(null, { status: 405 });
  }
  return faviconResponse(pathname);
}

function staticRequestPartsOrResponse(
  request: Request,
): StaticRequestParts | Response {
  const url = new URL(request.url);
  const earlyResponse = earlyStaticResponse(request, url.pathname);
  if (earlyResponse !== null) {
    return earlyResponse;
  }
  return {
    method: request.method,
    pathname: url.pathname,
  };
}

async function staticFrontendResponse(
  config: DesktopDaemonConfig,
  request: Request,
): Promise<Response> {
  const staticConfig = staticConfigOrResponse(config);
  if (staticConfig instanceof Response) {
    return staticConfig;
  }
  const requestParts = staticRequestPartsOrResponse(request);
  if (requestParts instanceof Response) {
    return requestParts;
  }
  const asset = await staticAssetOrResponse(
    staticConfig.webDir,
    requestParts.pathname,
  );
  if (asset instanceof Response) {
    return asset;
  }
  return assetResponse(config, asset, requestParts.method);
}

function registerStaticFrontendProtocol(
  config: DesktopDaemonConfig,
  registry: StaticProtocolRegistry,
): void {
  if (config.frontend.kind !== "static") {
    return;
  }
  registry.handle(desktopStaticScheme, async (request) => {
    const response = await staticFrontendResponse(config, request);
    return response;
  });
}

function frontendUrl(config: DesktopDaemonConfig): string {
  if (config.frontend.kind === "url") {
    return config.frontend.url;
  }
  return `${desktopStaticOrigin}/`;
}

export {
  desktopStaticScheme,
  frontendUrl,
  injectRuntimeConfig,
  registerStaticFrontendProtocol,
  resolveStaticAsset,
  staticFrontendResponse,
};
