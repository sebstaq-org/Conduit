export const relayBackedBrowserE2eRunsInRequiredCi = process.env.CI === "true";

// Do not enable relay-backed browser specs in required CI. They depend on
// cross-process relay timing and must stay local-only until that path is deterministic.
export const relayBackedBrowserE2eCiSkipReason =
  "Relay-backed browser E2E is forbidden in required CI because it is timing-flaky; run it locally only.";
