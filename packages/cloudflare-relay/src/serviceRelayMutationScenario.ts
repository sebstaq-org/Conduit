import { expect } from "vitest";
import { closeCapturedSockets } from "./serviceRelayTestUtils.js";
import { createRelaySessionClient } from "@conduit/session-client";
import type { ConnectionOfferV1 } from "@conduit/app-client";

async function runRelaySessionMutationScenario(
  offer: ConnectionOfferV1,
): Promise<void> {
  const telemetry: unknown[] = [];
  const capturedSockets: WebSocket[] = [];
  const sentFrames: string[] = [];
  const client = createRelaySessionClient({
    offer,
    WebSocketImpl: capturingSentWebSocket(capturedSockets, sentFrames),
    onTelemetryEvent: (event) => telemetry.push(event),
  });

  const snapshot = await waitForCodexConfigSnapshot(client);
  expect(configValue(snapshot.configOptions, "model")).toBe("gpt-5.5");
  expect(configValue(snapshot.configOptions, "reasoning_effort")).toBe("high");
  expect(configValue(snapshot.configOptions, "collaboration_mode")).toBe(
    "default",
  );

  const created = await client.newSession("codex", {
    cwd: "/tmp/conduit-e2e-fixture-project",
    limit: 20,
  });
  expect(created.ok).toBe(true);
  expect(created.result?.sessionId).toBe("e2e-codex-new-session-0001");
  const openSessionId = created.result?.history.openSessionId;
  expect(openSessionId).toEqual(expect.any(String));
  if (openSessionId === undefined) {
    throw new Error("session/new did not return openSessionId");
  }

  const timelineEvents: unknown[] = [];
  const unsubscribe = await client.subscribeTimelineChanges(
    openSessionId,
    (event) => timelineEvents.push(event),
  );

  await expectConfigUpdate(client, "model", "gpt-5.4-mini");
  await expectConfigUpdate(client, "reasoning_effort", "medium");
  await expectConfigUpdate(client, "collaboration_mode", "plan");
  await expect(
    client.promptSession({
      openSessionId,
      prompt: [
        {
          text: "Create a minimal deterministic plan for a Conduit E2E proof. Do not mention private paths, credentials, users, dates, machines, or external services. Return a short plan with the exact heading CONDUIT_E2E_CAPTURED_TERMINAL_PLAN.",
          type: "text",
        },
      ],
    }),
  ).resolves.toBeUndefined();

  const history = await client.readSessionHistory({
    limit: 20,
    openSessionId,
  });
  expect(history.ok).toBe(true);
  expect(JSON.stringify(history.result)).toContain(
    "CONDUIT_E2E_CAPTURED_TERMINAL_PLAN",
  );
  expect(JSON.stringify(timelineEvents)).toContain(
    "CONDUIT_E2E_CAPTURED_TERMINAL_PLAN",
  );

  unsubscribe();
  client.close();
  await closeCapturedSockets(capturedSockets);
  expect(sentFrames.join("\n")).not.toContain(
    "CONDUIT_E2E_CAPTURED_TERMINAL_PLAN",
  );
  expect(JSON.stringify(telemetry)).toContain("session/prompt");
}

async function expectConfigUpdate(
  client: ReturnType<typeof createRelaySessionClient>,
  configId: string,
  value: string,
): Promise<void> {
  const response = await client.setSessionConfigOption("codex", {
    configId,
    sessionId: "e2e-codex-new-session-0001",
    value,
  });
  expect(response.ok).toBe(true);
  expect(configValue(response.result?.configOptions ?? [], configId)).toBe(
    value,
  );
}

async function waitForCodexConfigSnapshot(
  client: ReturnType<typeof createRelaySessionClient>,
): Promise<{
  readonly configOptions: readonly {
    readonly currentValue?: unknown;
    readonly id: string;
  }[];
}> {
  await expect
    .poll(
      async () => {
        const snapshot = await client.getProvidersConfigSnapshot();
        return snapshot.entries.find((entry) => entry.provider === "codex")
          ?.status;
      },
      { timeout: 30000 },
    )
    .toBe("ready");
  const snapshot = await client.getProvidersConfigSnapshot();
  const codex = snapshot.entries.find((entry) => entry.provider === "codex");
  if (codex === undefined || codex.configOptions === null) {
    throw new Error("codex provider config snapshot is not ready");
  }
  return { configOptions: codex.configOptions };
}

function configValue(
  options: readonly { readonly currentValue?: unknown; readonly id: string }[],
  id: string,
): unknown {
  return options.find((option) => option.id === id)?.currentValue;
}

function capturingSentWebSocket(
  captured: WebSocket[],
  sentFrames: string[],
): typeof WebSocket {
  return class CapturingSentWebSocket extends WebSocket {
    public constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      captured.push(this);
    }

    public override send(data: Parameters<WebSocket["send"]>[0]): void {
      if (typeof data === "string") {
        sentFrames.push(data);
      }
      super.send(data);
    }
  };
}

export { runRelaySessionMutationScenario };
