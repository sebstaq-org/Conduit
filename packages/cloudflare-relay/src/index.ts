import { RelayDurableObject } from "./relayObject.js";
import { parseRelayRoute } from "./request.js";
import type { RelayRoute } from "./request.js";
import type { DurableObjectNamespaceLike } from "./workerTypes.js";

interface Env {
  readonly RELAY: DurableObjectNamespaceLike;
}

function json(value: unknown, init?: ResponseInit): Response {
  return Response.json(value, init);
}

function routeRelay(request: Request, env: Env): Response | Promise<Response> {
  const parsed = parseRelayRoute(request);
  if (parsed instanceof Response) {
    return parsed;
  }
  return relayObjectFetch(parsed, request, env);
}

function relayObjectFetch(
  route: RelayRoute,
  request: Request,
  env: Env,
): Promise<Response> {
  const id = env.RELAY.idFromName(route.serverId);
  const url = new URL(request.url);
  url.searchParams.set("socketKind", route.socket.kind);
  if ("connectionId" in route.socket) {
    url.searchParams.set("connectionId", route.socket.connectionId);
  }
  return env.RELAY.get(id).fetch(new Request(url, request));
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "conduit-relay" });
    }
    if (url.pathname.startsWith("/v1/relay/")) {
      return routeRelay(request, env);
    }
    return new Response("not found", { status: 404 });
  },
};

export { RelayDurableObject, routeRelay };
export type { Env };
