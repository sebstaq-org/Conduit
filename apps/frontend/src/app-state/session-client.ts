import { createSessionClient } from "@conduit/session-client";
import type { SessionClientPort } from "@conduit/session-client";

function configuredSessionClientUrl(): string | null {
  const configuredUrl = process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  if (configuredUrl === undefined) {
    return null;
  }
  const url = configuredUrl.trim();
  if (url.length === 0) {
    return null;
  }
  return url;
}

const sessionClient = ((): SessionClientPort => {
  const sessionClientUrl = configuredSessionClientUrl();
  if (sessionClientUrl === null) {
    return createSessionClient();
  }
  return createSessionClient({ url: sessionClientUrl });
})();

export { configuredSessionClientUrl, sessionClient };
export type { SessionClientPort };
