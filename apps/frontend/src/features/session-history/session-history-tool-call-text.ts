const TOOL_CALL_PREVIEW_LIMIT = 1200;
const TOOL_CALL_SUMMARY_LIMIT = 180;

interface ClippedText {
  text: string;
  truncated: boolean;
}

interface ToolCallTextInput {
  content: unknown;
  locations: unknown;
  rawInput: unknown;
  rawOutput: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function countArray(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }
  return value.length;
}

function clipText(text: string, limit: number): ClippedText {
  const normalized = text.replaceAll("\r", "").trim();
  if (normalized.length <= limit) {
    return { text: normalized, truncated: false };
  }
  const headLength = Math.floor(limit * 0.72);
  const tailLength = limit - headLength;
  return {
    text: `${normalized.slice(0, headLength).trimEnd()}\n...\n${normalized
      .slice(-tailLength)
      .trimStart()}`,
    truncated: true,
  };
}

function diffHeader(path: string | null): string {
  if (path === null) {
    return "Diff";
  }
  return `Diff ${path}`;
}

function terminalLabel(terminalId: string | null): string {
  if (terminalId === null) {
    return "Terminal output";
  }
  return `Terminal ${terminalId}`;
}

function textFromDiffBlock(value: Record<string, unknown>): string {
  const path = nonEmptyString(value.path);
  const parts = [
    diffHeader(path),
    nonEmptyString(value.oldText),
    nonEmptyString(value.newText),
  ];
  return parts.filter((part): part is string => part !== null).join("\n");
}

function textFromTypedContentBlock(
  value: Record<string, unknown>,
): string | null {
  if (value.type === "content" && isRecord(value.content)) {
    return nonEmptyString(value.content.text);
  }
  if (value.type === "diff") {
    return textFromDiffBlock(value);
  }
  if (value.type === "terminal") {
    return terminalLabel(nonEmptyString(value.terminalId));
  }
  return null;
}

function textFromContentBlock(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return textFromTypedContentBlock(value);
}

function textFromContent(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const text = value
    .map((entry) => textFromContentBlock(entry))
    .filter((entry): entry is string => entry !== null)
    .join("\n\n");
  return nonEmptyString(text);
}

function stringFromKnownOutputField(
  value: Record<string, unknown>,
): string | null {
  const keys = [
    "aggregated_output",
    "output",
    "stdout",
    "stderr",
    "content",
    "text",
    "message",
    "result",
  ];
  for (const key of keys) {
    const direct = nonEmptyString(value[key]);
    if (direct !== null) {
      return direct;
    }
  }
  return null;
}

interface PendingOutputValue {
  depth: number;
  value: unknown;
}

function nestedOutputValues(
  value: unknown,
  depth: number,
): PendingOutputValue[] {
  if (Array.isArray(value)) {
    const entries: PendingOutputValue[] = [];
    for (const entry of value) {
      const nestedValue: unknown = entry;
      entries.push({ depth: depth + 1, value: nestedValue });
    }
    return entries;
  }
  if (isRecord(value)) {
    return Object.values(value).map((entry) => ({
      depth: depth + 1,
      value: entry,
    }));
  }
  return [];
}

function outputTextForPending(entry: PendingOutputValue): string | null {
  const direct = nonEmptyString(entry.value);
  if (direct !== null) {
    return direct;
  }
  if (!isRecord(entry.value)) {
    return null;
  }
  return stringFromKnownOutputField(entry.value);
}

function findOutputText(value: unknown): string | null {
  const pending: PendingOutputValue[] = [{ depth: 0, value }];
  while (pending.length > 0) {
    const entry = pending.shift();
    if (entry !== undefined && entry.depth <= 4) {
      const direct = outputTextForPending(entry);
      if (direct !== null) {
        return direct;
      }
      pending.push(...nestedOutputValues(entry.value, entry.depth));
    }
  }
  return null;
}

function previewSource(input: ToolCallTextInput): string | null {
  const contentText = textFromContent(input.content);
  if (contentText !== null) {
    return contentText;
  }
  const outputText = findOutputText(input.rawOutput);
  if (outputText !== null) {
    return outputText;
  }
  return findOutputText(input.rawInput);
}

function firstLocationPath(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const entry of value) {
    if (isRecord(entry)) {
      const path = nonEmptyString(entry.path);
      if (path !== null) {
        return path;
      }
    }
  }
  return null;
}

function previewForToolCall(input: ToolCallTextInput): ClippedText {
  const preview = previewSource(input);
  if (preview === null) {
    return { text: "", truncated: false };
  }
  return clipText(preview, TOOL_CALL_PREVIEW_LIMIT);
}

function summaryForToolCall(input: ToolCallTextInput): string | null {
  const location = firstLocationPath(input.locations);
  if (location !== null) {
    return clipText(location, TOOL_CALL_SUMMARY_LIMIT).text;
  }
  const preview = previewSource(input);
  if (preview === null) {
    return null;
  }
  return clipText(preview, TOOL_CALL_SUMMARY_LIMIT).text.replaceAll(
    /\s+/g,
    " ",
  );
}

export {
  TOOL_CALL_PREVIEW_LIMIT,
  countArray,
  nonEmptyString,
  previewForToolCall,
  summaryForToolCall,
};
export type { ClippedText, ToolCallTextInput };
