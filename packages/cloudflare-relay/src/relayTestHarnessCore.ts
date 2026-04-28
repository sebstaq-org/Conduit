type TestSocket = Pick<WebSocket, "addEventListener" | "close" | "send">;

interface RelayTestHarness {
  readonly endpoint: string;
  readonly fetchJson: (path: string) => Promise<unknown>;
  readonly openRejectedSocket: (
    url: string,
    capability?: string,
  ) => Promise<void>;
  readonly openSocket: (url: string, capability: string) => Promise<TestSocket>;
}

function waitForMessage(
  socket: TestSocket,
  label = "relay message",
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`timed out waiting for ${label}`));
      }
    }, 15000);
    socket.addEventListener("message", (event: MessageEvent) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (typeof event.data !== "string") {
        reject(new Error("relay test expected string websocket frame"));
        return;
      }
      resolve(event.data);
    });
  });
}

export { waitForMessage };
export type { RelayTestHarness, TestSocket };
