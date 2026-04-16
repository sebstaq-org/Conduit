interface SessionClientTelemetryEvent {
  event_name: string;
  level: "debug" | "info" | "warn" | "error";
  fields?: Record<string, unknown>;
}

export type { SessionClientTelemetryEvent };
