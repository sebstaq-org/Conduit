type FrontendLogLevel = "debug" | "info" | "warn" | "error";
type FrontendLogProfile = "dev" | "stage" | "prod";
type FrontendLogFields = Record<string, unknown>;

interface FrontendLogRecord {
  event_name: string;
  level: FrontendLogLevel;
  log_profile: FrontendLogProfile;
  source: "frontend";
  timestamp: string;
  [field: string]: unknown;
}

interface FrontendLogSink {
  write(record: FrontendLogRecord, error?: unknown): void;
}

export type {
  FrontendLogFields,
  FrontendLogLevel,
  FrontendLogProfile,
  FrontendLogRecord,
  FrontendLogSink,
};
