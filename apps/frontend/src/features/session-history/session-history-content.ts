import type { TranscriptContentPart, TranscriptItem } from "@/app-state/models";

function textFromTranscriptContent(content: TranscriptContentPart[]): string {
  return content
    .flatMap((part) => {
      if (part.kind !== "text") {
        return [];
      }
      return [part.text];
    })
    .join("");
}

function transcriptItemLabel(item: TranscriptItem): string {
  if (item.kind === "event") {
    return item.variant;
  }
  const text = textFromTranscriptContent(item.content).trim();
  if (text.length > 0) {
    return text;
  }
  return `${item.role} content block`;
}

function transcriptItemMeta(item: TranscriptItem): string {
  if (item.kind === "event") {
    return "event";
  }
  const status = item.status ?? "complete";
  return `${item.role} ${status}`;
}

export { textFromTranscriptContent, transcriptItemLabel, transcriptItemMeta };
