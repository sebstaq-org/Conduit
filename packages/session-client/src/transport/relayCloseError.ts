const closeCodeMessageTooBig = 1009;
const relayFrameTooLargeReason = "relay frame too large";
const relayFrameTooLargeMessage =
  "Relay message too large. The session response exceeded the relay frame limit.";

function relayCloseError(
  event: CloseEvent | undefined,
  fallback: string,
): Error {
  if (
    event?.code === closeCodeMessageTooBig &&
    event.reason === relayFrameTooLargeReason
  ) {
    return new Error(relayFrameTooLargeMessage);
  }
  return new Error(fallback);
}

export { relayCloseError };
