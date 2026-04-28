import { CLOSE_POLICY } from "./limits.js";
import { safeClose } from "./socketSafety.js";
import type { RelayConnection } from "./relayState.js";

function closeDataSocketForTest(
  connections: Map<string, RelayConnection>,
  connectionId: string,
): Response {
  const connection = connections.get(connectionId);
  safeClose(
    connection?.dataSocket ?? null,
    CLOSE_POLICY,
    "relay test closed data socket",
  );
  return Response.json({ ok: true });
}

export { closeDataSocketForTest };
