function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageFromData(data: unknown): string | null {
  if (typeof data === "string") {
    return data;
  }
  if (!isRecord(data)) {
    return null;
  }
  if (typeof data.message === "string") {
    return data.message;
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  return null;
}

function statusErrorMessage(error: Record<string, unknown>): string | null {
  if (typeof error.status !== "string" && typeof error.status !== "number") {
    return null;
  }
  const detail = messageFromData(error.data) ?? messageFromData(error.error);
  if (detail === null) {
    return `Relay error ${String(error.status)}`;
  }
  return `Relay error ${String(error.status)}: ${detail}`;
}

function connectionErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (!isRecord(error)) {
    return null;
  }
  const statusMessage = statusErrorMessage(error);
  if (statusMessage !== null) {
    return statusMessage;
  }
  return messageFromData(error.message) ?? messageFromData(error.error);
}

export { connectionErrorMessage };
