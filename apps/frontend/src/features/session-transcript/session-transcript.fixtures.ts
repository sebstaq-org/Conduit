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
      text: 'Agreed. Start with transcript messages and keep composer, tools, and live state out of this slice.\n\n## Markdown proof\n\nThis row is rendered with **react-native-streamdown** while markdown stays readable.\n\n- lists should render as list items\n- inline code should render as code\n\n```ts\ntype Proof = {\n  renderer: "streamdown";\n  status: "working";\n};\n```',
    },
    {
      id: "agent-2",
      kind: "message",
      role: "agent",
      text: "This row simulates incomplete streaming markdown: **bold text still arriving\n\n- first item\n- second item with `inline code",
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
