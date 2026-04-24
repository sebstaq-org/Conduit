import { expect, it } from "vitest";
import { hostConnectionStatus } from "./host-connection-status";

it("uses gray for no paired desktop", () => {
  // Per user contract: mobile gray means no desktop is paired.
  // Do not change without an explicit product decision.
  expect(
    hostConnectionStatus({
      activeHostPaired: false,
      isError: false,
      isFetching: false,
      isSuccess: false,
    }),
  ).toMatchObject({
    indicator: "idle",
    label: "Desktop",
  });
});

it("uses spinner only while actively trying to connect", () => {
  // Per user contract: mobile spinner means an actual connection attempt is in progress.
  // Do not change without an explicit product decision.
  expect(
    hostConnectionStatus({
      activeHostPaired: true,
      isError: false,
      isFetching: true,
      isSuccess: false,
    }),
  ).toMatchObject({ indicator: "connecting", label: "Desktop" });
});

it("uses green only after a verified command roundtrip", () => {
  // Per user contract: mobile green requires a real session command result.
  // Do not change without an explicit product decision.
  expect(
    hostConnectionStatus({
      activeHostPaired: true,
      data: {},
      fulfilledTimeStamp: 1000,
      isError: false,
      isFetching: false,
      isSuccess: true,
    }),
  ).toMatchObject({ indicator: "connected", label: "Desktop" });
});

it("uses red when a paired desktop cannot be reached", () => {
  // Per user contract: mobile red means a paired desktop failed transport or roundtrip.
  // Do not change without an explicit product decision.
  expect(
    hostConnectionStatus({
      activeHostPaired: true,
      isError: true,
      isFetching: false,
      isSuccess: false,
    }),
  ).toMatchObject({ indicator: "disconnected", label: "Desktop" });
});
