import { describe, expect, it } from "vitest";

import {
  buildRelayWebSocketProtocol,
  buildRelayWebSocketUrl,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayCapability,
  parseRelayWebSocketProtocol,
} from "./protocol.js";

describe("relay protocol capabilities", () => {
  it("generates url-safe opaque capabilities", () => {
    const capability = generateRelayCapability();

    expect(capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("derives stable route ids from capabilities", () => {
    const daemonCapability = generateRelayCapability();
    const clientCapability = generateRelayCapability();

    expect(deriveRelayServerId(daemonCapability)).toMatch(
      /^srv_[A-Za-z0-9_-]{43}$/,
    );
    expect(deriveRelayConnectionId(clientCapability)).toMatch(
      /^conn_[A-Za-z0-9_-]{43}$/,
    );
    expect(deriveRelayServerId(daemonCapability)).toBe(
      deriveRelayServerId(daemonCapability),
    );
    expect(deriveRelayConnectionId(clientCapability)).toBe(
      deriveRelayConnectionId(clientCapability),
    );
  });

  it("parses only the relay websocket subprotocol", () => {
    const capability = generateRelayCapability();
    const protocol = buildRelayWebSocketProtocol(capability);

    expect(parseRelayWebSocketProtocol(`other, ${protocol}`)).toBe(capability);
    expect(() => parseRelayWebSocketProtocol(null)).toThrow(
      "relay websocket protocol is required",
    );
    expect(() => parseRelayWebSocketProtocol("other")).toThrow(
      "relay websocket protocol is invalid",
    );
    expect(() =>
      parseRelayWebSocketProtocol("conduit-relay.v1.not-base64"),
    ).toThrow("relay capability is invalid");
  });

  it("keeps capabilities out of relay websocket URLs", () => {
    const daemonCapability = generateRelayCapability();
    const url = buildRelayWebSocketUrl("https://relay.example.test", {
      capability: daemonCapability,
      role: "server",
      serverId: deriveRelayServerId(daemonCapability),
    });

    expect(url).not.toContain(daemonCapability);
    expect(Array.from(new URL(url).searchParams.keys())).not.toContain(
      "capability",
    );
  });

  it("rejects relay websocket URLs with unsupported endpoint protocols", () => {
    const daemonCapability = generateRelayCapability();

    expect(() =>
      buildRelayWebSocketUrl("ftp://relay.example.test", {
        capability: daemonCapability,
        role: "server",
        serverId: deriveRelayServerId(daemonCapability),
      }),
    ).toThrow("relay endpoint must use http or https");
  });
});
