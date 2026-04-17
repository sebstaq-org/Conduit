import { ConduitServerFrameSchema } from "@conduit/app-protocol";
import type {
  ConduitConsumerResponse,
  ConduitRuntimeEvent,
} from "@conduit/app-protocol";
import type { ConsumerResponse } from "@conduit/session-contracts";

interface ParsedServerResponseFrame {
  id: string;
  response: ConsumerResponse;
  type: "response";
}

interface ParsedServerEventFrame {
  event: ConduitRuntimeEvent;
  type: "event";
}

type ParsedServerFrame = ParsedServerResponseFrame | ParsedServerEventFrame;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readConsumerResponse(
  response: ConduitConsumerResponse,
): ConsumerResponse {
  return {
    error: response.error ?? null,
    id: response.id,
    ok: response.ok,
    result: response.result,
  };
}

function parseServerFrame(text: string): ParsedServerFrame | null {
  const parsed = parseJson(text);
  const frame = ConduitServerFrameSchema.safeParse(parsed);
  if (!frame.success) {
    return null;
  }
  if (frame.data.type === "response") {
    return {
      id: frame.data.id,
      response: readConsumerResponse(frame.data.response),
      type: "response",
    };
  }
  return {
    event: frame.data.event,
    type: "event",
  };
}

export { parseServerFrame };
export type { ParsedServerFrame };
