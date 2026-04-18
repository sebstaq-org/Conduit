type RelaySocketKind =
  | { readonly kind: "control" }
  | { readonly connectionId: string; readonly kind: "client" | "data" };

interface RelayRoute {
  readonly serverId: string;
  readonly socket: RelaySocketKind;
}

const relayIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

function parseRelayRoute(request: Request): RelayRoute | Response {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("websocket upgrade required", { status: 426 });
  }
  const url = new URL(request.url);
  return parseRelayUrl(url);
}

function parseRelayUrl(url: URL): RelayRoute | Response {
  const match = /^\/v1\/relay\/([^/]+)$/.exec(url.pathname);
  let serverId = "";
  if (match?.[1] !== undefined) {
    serverId = decodeURIComponent(match[1]);
  }
  if (!relayIdPattern.test(serverId)) {
    return new Response("invalid server id", { status: 400 });
  }
  const role = url.searchParams.get("role");
  const connectionId = url.searchParams.get("connectionId") ?? undefined;
  if (role === "server" && connectionId === undefined) {
    return { serverId, socket: { kind: "control" } };
  }
  if (connectionId === undefined || !relayIdPattern.test(connectionId)) {
    return new Response("invalid connection id", { status: 400 });
  }
  if (role === "server") {
    return { serverId, socket: { connectionId, kind: "data" } };
  }
  if (role === "client") {
    return { serverId, socket: { connectionId, kind: "client" } };
  }
  return new Response("invalid relay role", { status: 400 });
}

export { parseRelayRoute };
export type { RelayRoute, RelaySocketKind };
