function requireWebSocketUrl(configuredUrl: string | undefined): string {
  if (configuredUrl === undefined) {
    throw new Error(
      "session websocket url is required; pass createSessionClient({ url }).",
    );
  }
  const url = configuredUrl.trim();
  if (url.length === 0) {
    throw new Error("session websocket url must not be empty.");
  }
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    throw new Error("session websocket url must start with ws:// or wss://.");
  }
  return url;
}

export { requireWebSocketUrl };
