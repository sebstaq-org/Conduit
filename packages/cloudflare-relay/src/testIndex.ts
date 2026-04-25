import { RelayDurableObject, routeRelay } from "./index.js";
import type { DurableObjectNamespaceLike } from "./workerTypes.js";

interface TestEnv {
  readonly RELAY: DurableObjectNamespaceLike;
  readonly CONDUIT_RELAY_TEST_ADMIN_TOKEN?: string;
}

function json(value: unknown): Response {
  return Response.json(value);
}

function testAdminAuth(request: Request, env: TestEnv): true | Response {
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
): Response | { connectionId: string | null; serverId: string } {
  const url = new URL(request.url);
  const serverId = url.searchParams.get("serverId");
  const connectionId = url.searchParams.get("connectionId");
  if (serverId === null) {
    return new Response("missing route", { status: 400 });
  }
  return { connectionId, serverId };
}

interface TestAdminRelayObjectFetchOptions {
  readonly env: TestEnv;
  readonly request: Request;
  readonly route: { connectionId: string | null; serverId: string };
  readonly socketKind: "testCloseData" | "testSnapshot";
}

function testAdminRelayObjectFetch({
  env,
  request,
  route,
  socketKind,
}: TestAdminRelayObjectFetchOptions): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set("socketKind", socketKind);
  if (route.connectionId !== null) {
    url.searchParams.set("connectionId", route.connectionId);
  }
  const id = env.RELAY.idFromName(route.serverId);
  return env.RELAY.get(id).fetch(new Request(url, request));
}

function routeTestAdmin(
  request: Request,
  env: TestEnv,
  socketKind: "testCloseData" | "testSnapshot",
): Promise<Response> | Response {
  const auth = testAdminAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  const route = testAdminRoute(request);
  if (route instanceof Response) {
    return route;
  }
  return testAdminRelayObjectFetch({ env, request, route, socketKind });
}

const worker = {
  fetch(request: Request, env: TestEnv): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "conduit-relay-test" });
    }
    if (url.pathname.startsWith("/v1/relay/")) {
      return routeRelay(request, env);
    }
    if (url.pathname === "/__conduit_test/close-data") {
      return routeTestAdmin(request, env, "testCloseData");
    }
    if (url.pathname === "/__conduit_test/snapshot") {
      return routeTestAdmin(request, env, "testSnapshot");
    }
    return new Response("not found", { status: 404 });
  },
};

export default worker;
export { RelayDurableObject };
