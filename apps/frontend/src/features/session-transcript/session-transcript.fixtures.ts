import type { SessionTranscriptView } from "./session-transcript.types";

const mockSessionTranscript: SessionTranscriptView = {
  provider: "codex",
  rows: [
    {
      id: "user-1",
      kind: "message",
      role: "user",
      text: "Hiya. We need to keep this session view small at first.",
    },
    {
      id: "agent-1",
      kind: "message",
      role: "agent",
      text: "Agreed. Start with transcript messages and keep composer, tools, and live state out of this slice.",
    },
    {
      id: "thought-1",
      kind: "unsupported",
      variant: "agent_thought_chunk",
    },
  ],
  sessionId: "mock-session",
};

export { mockSessionTranscript };
