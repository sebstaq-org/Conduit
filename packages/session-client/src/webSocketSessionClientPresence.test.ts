import { expect, it, vi } from "vitest";
import { WebSocketSessionClient } from "./webSocketSessionClient.js";
import type { CommandTransport } from "./transport/commandTransport.js";

it("sends presence update through the same command transport as session commands", () => {
  // Per user contract: client presence must be real session transport traffic, not UI-local state.
  // Do not change without an explicit product decision.
  const dispatch = vi.fn<CommandTransport["dispatch"]>();
  dispatch.mockResolvedValue({
    error: null,
    id: "presence-update-ack",
    ok: true,
    result: { accepted: true },
  });
  const transport: CommandTransport = {
    close: vi.fn<() => void>(),
    dispatch,
  };
  const client = new WebSocketSessionClient({}, transport);

  void client.updatePresence({
    clientId: "client-1",
    deviceKind: "mobile",
    displayName: "Base iPhone",
  });

  expect(dispatch.mock.calls).toHaveLength(1);
  expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
    command: "presence/update",
    provider: "all",
    params: {
      clientId: "client-1",
      deviceKind: "mobile",
      displayName: "Base iPhone",
    },
  });
});
