import { describe, expect, it } from "vitest";
import {
  hostConnectionStatus,
  recentSuccessGraceMs,
} from "./host-connection-status";

describe(hostConnectionStatus, () => {
  it("reports connecting only before the first verified relay command", () => {
    expect(
      hostConnectionStatus({
        activeHostPaired: true,
        isError: false,
        isFetching: true,
        isSuccess: false,
      }),
    ).toMatchObject({ indicator: "connecting", label: "Desktop" });
  });

  it("keeps a verified connection green during background polling", () => {
    expect(
      hostConnectionStatus({
        activeHostPaired: true,
        data: {},
        fulfilledTimeStamp: 1000,
        isError: false,
        isFetching: true,
        isSuccess: true,
      }),
    ).toMatchObject({ indicator: "connected", label: "Desktop" });
  });
});

describe("transient relay failures", () => {
  it("does not flicker red on a fresh transient polling failure", () => {
    expect(
      hostConnectionStatus(
        {
          activeHostPaired: true,
          data: {},
          fulfilledTimeStamp: 1000,
          isError: true,
          isFetching: false,
          isSuccess: false,
        },
        1000 + recentSuccessGraceMs - 1,
      ),
    ).toMatchObject({
      indicator: "connected",
      label: "Desktop",
      reason: "Last verified moments ago",
    });
  });

  it("turns red after a failed connection has no fresh verified success", () => {
    expect(
      hostConnectionStatus(
        {
          activeHostPaired: true,
          data: {},
          fulfilledTimeStamp: 1000,
          isError: true,
          isFetching: false,
          isSuccess: false,
        },
        1000 + recentSuccessGraceMs + 1,
      ),
    ).toMatchObject({
      indicator: "disconnected",
      label: "Desktop",
      reason: "Relay failed",
    });
  });
});
