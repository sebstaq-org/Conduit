import type { SessionTranscriptMessageRole } from "./session-transcript.types";

const sessionTranscriptGap = "lg" as const;
const sessionTranscriptMetaVariant = "sectionTitle" as const;
const sessionTranscriptRowGap = "xs" as const;
const sessionTranscriptTextVariant = "rowLabel" as const;

function sessionTranscriptRoleLabel(
  role: SessionTranscriptMessageRole,
): string {
  if (role === "user") {
    return "You";
  }

  return "Assistant";
}

export {
  sessionTranscriptGap,
  sessionTranscriptMetaVariant,
  sessionTranscriptRoleLabel,
  sessionTranscriptRowGap,
  sessionTranscriptTextVariant,
};
