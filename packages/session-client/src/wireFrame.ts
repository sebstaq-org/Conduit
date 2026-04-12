import { CONDUIT_TRANSPORT_VERSION } from "@conduit/session-contracts";
import type { ServerFrame } from "@conduit/session-contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isServerFrame(value: unknown): value is ServerFrame {
  if (!isRecord(value) || value.v !== CONDUIT_TRANSPORT_VERSION) {
    return false;
  }
  if (value.type === "response") {
    return typeof value.id === "string" && isRecord(value.response);
  }
  return value.type === "event" && isRecord(value.event);
}

function parseServerFrame(text: string): ServerFrame | null {
  const parsed: unknown = JSON.parse(text);
  if (!isServerFrame(parsed)) {
    return null;
  }
  return parsed;
}

export { parseServerFrame };
