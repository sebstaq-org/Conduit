import { RelayDurableObject } from "./relayObject.js";
import { parseRelayRoute } from "./request.js";
import type { RelayRoute } from "./request.js";
import type { DurableObjectNamespaceLike } from "./workerTypes.js";

interface Env {
  readonly RELAY: DurableObjectNamespaceLike;
  readonly CONDUIT_RELAY_TEST_ADMIN_TOKEN?: string;
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

function routeTestAdmin(
  request: Request,
  env: Env,
): Promise<Response> | Response {
  const auth = testAdminAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  const route = testAdminRoute(request);
  if (route instanceof Response) {
    return route;
  }
  return testAdminRelayObjectFetch(request, env, route);
}

function testAdminAuth(request: Request, env: Env): true | Response {
  const token = env.CONDUIT_RELAY_TEST_ADMIN_TOKEN;
  if (token === undefined || token.length === 0) {
    return new Response("not found", { status: 404 });
  }
  if (request.headers.get("Authorization") !== `Bearer ${token}`) {
    return new Response("forbidden", { status: 403 });
  }
  return true;
}

function testAdminRoute(
  request: Request,
): Response | { connectionId: string; serverId: string } {
  const url = new URL(request.url);
  const serverId = url.searchParams.get("serverId");
  const connectionId = url.searchParams.get("connectionId");
  if (serverId === null || connectionId === null) {
    return new Response("missing route", { status: 400 });
  }
  return { connectionId, serverId };
}

function testAdminRelayObjectFetch(
  request: Request,
  env: Env,
  route: { connectionId: string; serverId: string },
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set("socketKind", "testCloseData");
  url.searchParams.set("connectionId", route.connectionId);
  const id = env.RELAY.idFromName(route.serverId);
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
    if (url.pathname === "/__conduit_test/close-data") {
      return routeTestAdmin(request, env);
    }
    return new Response("not found", { status: 404 });
  },
};

export { RelayDurableObject };
