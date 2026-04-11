type SessionTranscriptProvider = "claude" | "codex" | "copilot";

type SessionTranscriptMessageRole = "agent" | "user";

interface SessionTranscriptMessageRow {
  id: string;
  kind: "message";
  role: SessionTranscriptMessageRole;
  text: string;
}

interface SessionTranscriptUnsupportedRow {
  id: string;
  kind: "unsupported";
  variant: string;
}

type SessionTranscriptItem =
  | SessionTranscriptMessageRow
  | SessionTranscriptUnsupportedRow;

interface SessionTranscriptView {
  provider: SessionTranscriptProvider;
  rows: SessionTranscriptItem[];
  sessionId: string;
}

export type {
  SessionTranscriptMessageRole,
  SessionTranscriptMessageRow,
  SessionTranscriptProvider,
  SessionTranscriptItem,
  SessionTranscriptUnsupportedRow,
  SessionTranscriptView,
};
