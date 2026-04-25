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
      hostConnectionStatus(
        {
          activeHostPaired: true,
          data: {},
          fulfilledTimeStamp: 1000,
          isError: false,
          isFetching: true,
          isSuccess: true,
        },
        1000 + recentSuccessGraceMs - 1,
      ),
    ).toMatchObject({ indicator: "connected", label: "Desktop" });
  });

});

describe("stale relay success", () => {
  it("does not render stale RTK Query success as connected", () => {
    expect(
      hostConnectionStatus(
        {
          activeHostPaired: true,
          data: {},
          fulfilledTimeStamp: 1000,
          isError: false,
          isFetching: false,
          isSuccess: true,
        },
        1000 + recentSuccessGraceMs + 1,
      ),
    ).toMatchObject({
      indicator: "idle",
      label: "Desktop",
      reason: "Relay idle",
    });
  });

  it("uses spinner when stale data is being actively refreshed", () => {
    expect(
      hostConnectionStatus(
        {
          activeHostPaired: true,
          data: {},
          fulfilledTimeStamp: 1000,
          isError: false,
          isFetching: true,
          isSuccess: true,
        },
        1000 + recentSuccessGraceMs + 1,
      ),
    ).toMatchObject({
      indicator: "connecting",
      label: "Desktop",
      reason: "Relay connecting",
    });
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
