import { RELAY_PROTOCOL_VERSION } from "@conduit/relay-transport";

function controlFrame(
  type: "client_waiting" | "data_closed" | "client_closed",
  connectionId: string,
): string {
  return JSON.stringify({
    v: RELAY_PROTOCOL_VERSION,
    type,
    connectionId,
  });
}

function frameBytes(message: ArrayBuffer | string): number {
  if (typeof message === "string") {
    return new TextEncoder().encode(message).byteLength;
  }
  return message.byteLength;
}

export { controlFrame, frameBytes };
