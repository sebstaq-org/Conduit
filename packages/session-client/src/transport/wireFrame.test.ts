import { expect, it } from "vitest";
import { parseServerFrame } from "./wireFrame.js";

const protocolVersionField = "v";

it("parses generated response frames and drops transport-only snapshots", () => {
  const frame = parseServerFrame(
    JSON.stringify({
      [protocolVersionField]: 1,
      type: "response",
      id: "cmd-1",
      response: {
        id: "cmd-1",
        ok: true,
        result: { subscribed: true },
        error: null,
        snapshot: { provider: "codex" },
      },
    }),
  );

  expect(frame).toEqual({
    type: "response",
    id: "cmd-1",
    response: {
      id: "cmd-1",
      ok: true,
      result: { subscribed: true },
      error: null,
    },
  });
});

it("rejects unsupported versions and malformed runtime events", () => {
  expect(
    parseServerFrame(
      JSON.stringify({
        [protocolVersionField]: 2,
        type: "response",
        id: "cmd-1",
        response: { id: "cmd-1", ok: true, result: null, error: null },
      }),
    ),
  ).toBeNull();

  expect(
    parseServerFrame(
      JSON.stringify({
        [protocolVersionField]: 1,
        type: "event",
        event: {
          kind: "session_timeline_changed",
          openSessionId: "open-1",
          revision: 4,
          items: [{ kind: "message", id: "item-1", role: "agent" }],
        },
      }),
    ),
  ).toBeNull();
});

it("rejects server frames with extra wire fields", () => {
  expect(
    parseServerFrame(
      JSON.stringify({
        [protocolVersionField]: 1,
        type: "event",
        event: {
          kind: "sessions_index_changed",
          revision: 4,
        },
        unexpected: true,
      }),
    ),
  ).toBeNull();
});

it("parses generated runtime event frames", () => {
  const frame = parseServerFrame(
    JSON.stringify({
      [protocolVersionField]: 1,
      type: "event",
      event: {
        kind: "session_timeline_changed",
        openSessionId: "open-1",
        revision: 4,
        items: [
          {
            kind: "message",
            id: "item-1",
            role: "agent",
            content: [{ type: "text", text: "hello" }],
          },
        ],
      },
    }),
  );

  expect(frame?.type).toBe("event");
  if (
    frame?.type === "event" &&
    frame.event.kind === "session_timeline_changed"
  ) {
    expect(frame.event.kind).toBe("session_timeline_changed");
    expect(frame.event.items).toHaveLength(1);
  }
});
