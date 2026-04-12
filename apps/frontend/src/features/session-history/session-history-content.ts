import type { ContentBlock, TranscriptItem } from "@conduit/session-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFromContentBlocks(content: ContentBlock[]): string {
  return content
    .flatMap((block) => {
      if (
        !isRecord(block) ||
        block.type !== "text" ||
        typeof block.text !== "string"
      ) {
        return [];
      }
      return [block.text];
    })
    .join("");
}

function transcriptItemLabel(item: TranscriptItem): string {
  if (item.kind === "event") {
    return item.variant;
  }
  const text = textFromContentBlocks(item.content).trim();
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

export { textFromContentBlocks, transcriptItemLabel, transcriptItemMeta };
