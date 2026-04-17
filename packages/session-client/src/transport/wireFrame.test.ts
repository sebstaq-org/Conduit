import { expect, it } from "vitest";
import { parseServerFrame } from "./wireFrame.js";

it("parses generated response frames and drops transport-only snapshots", () => {
  const frame = parseServerFrame(
    JSON.stringify({
      v: 1,
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
        v: 2,
        type: "response",
        id: "cmd-1",
        response: { id: "cmd-1", ok: true, result: null, error: null },
      }),
    ),
  ).toBeNull();

  expect(
    parseServerFrame(
      JSON.stringify({
        v: 1,
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

it("parses generated runtime event frames", () => {
  const frame = parseServerFrame(
    JSON.stringify({
      v: 1,
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
