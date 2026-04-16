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

export type {
  FrontendLogFields,
  FrontendLogLevel,
  FrontendLogProfile,
  FrontendLogRecord,
};
