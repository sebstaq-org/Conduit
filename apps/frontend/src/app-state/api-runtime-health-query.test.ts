import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeHealthView } from "./api-runtime-health-query";

interface RuntimeHealthQueryModule {
  getRuntimeHealthQuery: () => Promise<
    { data: RuntimeHealthView } | { error: string }
  >;
}

async function importModule(): Promise<RuntimeHealthQueryModule> {
  vi.resetModules();
  process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL =
    "ws://127.0.0.1:4274/api/session";
  const module = await import("./api-runtime-health-query");
  return module;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  vi.unstubAllGlobals();
});

it("surfaces backend telemetry error messages from unhealthy runtime health responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Response.json(
        {
          ok: false,
          error_code: "telemetry_io_failed",
          error_message: "disk full",
        },
        { status: 503 },
      ),
    ),
  );
  const module = await importModule();
  const result = await module.getRuntimeHealthQuery();
  expect(result).toEqual({ error: "disk full" });
});

it("returns healthy runtime metadata from valid health responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Response.json(
        {
          ok: true,
          service: "conduit-service",
          transport: "websocket",
        },
        { status: 200 },
      ),
    ),
  );
  const module = await importModule();
  const result = await module.getRuntimeHealthQuery();
  expect("data" in result && result.data.service).toBe("conduit-service");
  expect("data" in result && result.data.transport).toBe("websocket");
});
