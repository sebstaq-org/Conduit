import { expect, it } from "vitest";
import { WebSocketSessionClient } from "./webSocketSessionClient.js";
import type { CommandTransport } from "./transport/commandTransport.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
} from "@conduit/session-contracts";

class CapturingTransport implements CommandTransport {
  public closed = false;
  public readonly commands: ConsumerCommand[] = [];

  public close(): void {
    this.closed = true;
  }

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    this.commands.push(command);
    return {
      error: null,
      id: command.id,
      ok: true,
      result: { accepted: true },
    };
  }
}

it("sends presence update through the same command transport as session commands", async () => {
  // Per user contract: client presence must be real session transport traffic, not UI-local state.
  // Do not change without an explicit product decision.
  const transport = new CapturingTransport();
  const client = new WebSocketSessionClient({}, transport);

  await client.updatePresence({
    clientId: "client-1",
    deviceKind: "mobile",
    displayName: "Base iPhone",
  });

  expect(transport.commands).toHaveLength(1);
  expect(transport.commands[0]).toMatchObject({
    command: "presence/update",
    provider: "all",
    params: {
      clientId: "client-1",
      deviceKind: "mobile",
      displayName: "Base iPhone",
    },
  });
});
