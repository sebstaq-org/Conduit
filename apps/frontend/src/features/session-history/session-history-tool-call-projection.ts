import type { TranscriptItem } from "@conduit/session-client";
import {
  TOOL_CALL_PREVIEW_LIMIT,
  countArray,
  nonEmptyString,
  previewForToolCall,
  summaryForToolCall,
} from "./session-history-tool-call-text";

interface SessionHistoryToolCallProjection {
  contentCount: number;
  id: string;
  kind: "tool_call_projection";
  kindLabel: string;
  locationCount: number;
  preview: string | null;
  statusLabel: string;
  summary: string | null;
  title: string;
  toolCallId: string;
  truncated: boolean;
  updateCount: number;
}

type SessionHistoryProjectedItem =
  | TranscriptItem
  | SessionHistoryToolCallProjection;

interface ToolCallData {
  content?: unknown;
  kind?: unknown;
  locations?: unknown;
  rawInput?: unknown;
  rawOutput?: unknown;
  sessionUpdate?: unknown;
  status?: unknown;
  title?: unknown;
  toolCallId: string;
}

interface ToolCallAccumulator {
  content: unknown;
  firstIndex: number;
  id: string;
  kind: string | null;
  locations: unknown;
  rawInput: unknown;
  rawOutput: unknown;
  status: string | null;
  title: string | null;
  toolCallId: string;
  updateCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolCallData(item: TranscriptItem): ToolCallData | null {
  if (item.kind !== "event" || !isRecord(item.data)) {
    return null;
  }
  if (
    item.data.sessionUpdate !== "tool_call" &&
    item.data.sessionUpdate !== "tool_call_update"
  ) {
    return null;
  }
  const toolCallId = nonEmptyString(item.data.toolCallId);
  if (toolCallId === null) {
    return null;
  }
  return {
    content: item.data.content,
    kind: item.data.kind,
    locations: item.data.locations,
    rawInput: item.data.rawInput,
    rawOutput: item.data.rawOutput,
    sessionUpdate: item.data.sessionUpdate,
    status: item.data.status,
    title: item.data.title,
    toolCallId,
  };
}

function normalizedLabel(value: unknown): string | null {
  const label = nonEmptyString(value);
  if (label === null) {
    return null;
  }
  return label.replaceAll("_", " ");
}

function itemTitle(data: ToolCallData): string | null {
  return nonEmptyString(data.title);
}

function createAccumulator(
  data: ToolCallData,
  firstIndex: number,
): ToolCallAccumulator {
  return {
    content: data.content,
    firstIndex,
    id: `tool-call:${data.toolCallId}`,
    kind: normalizedLabel(data.kind),
    locations: data.locations,
    rawInput: data.rawInput,
    rawOutput: data.rawOutput,
    status: normalizedLabel(data.status),
    title: itemTitle(data),
    toolCallId: data.toolCallId,
    updateCount: 1,
  };
}

function mergeNullable<Value>(
  current: Value,
  incoming: Value | undefined,
): Value {
  if (incoming === undefined || incoming === null) {
    return current;
  }
  return incoming;
}

function mergeAccumulator(
  accumulator: ToolCallAccumulator,
  data: ToolCallData,
): void {
  accumulator.content = mergeNullable(accumulator.content, data.content);
  accumulator.kind = normalizedLabel(data.kind) ?? accumulator.kind;
  accumulator.locations = mergeNullable(accumulator.locations, data.locations);
  accumulator.rawInput = mergeNullable(accumulator.rawInput, data.rawInput);
  accumulator.rawOutput = mergeNullable(accumulator.rawOutput, data.rawOutput);
  accumulator.status = normalizedLabel(data.status) ?? accumulator.status;
  accumulator.title = itemTitle(data) ?? accumulator.title;
  accumulator.updateCount += 1;
}

function appendNewToolCall(args: {
  data: ToolCallData;
  projected: (SessionHistoryProjectedItem | null)[];
  toolCallsById: Map<string, ToolCallAccumulator>;
}): void {
  const accumulator = createAccumulator(args.data, args.projected.length);
  args.toolCallsById.set(args.data.toolCallId, accumulator);
  args.projected.push(null);
}

function nonEmptyPreview(text: string): string | null {
  if (text.length === 0) {
    return null;
  }
  return text;
}

function projectionFromAccumulator(
  accumulator: ToolCallAccumulator,
): SessionHistoryToolCallProjection {
  const textInput = {
    content: accumulator.content,
    locations: accumulator.locations,
    rawInput: accumulator.rawInput,
    rawOutput: accumulator.rawOutput,
  };
  const clippedPreview = previewForToolCall(textInput);
  return {
    contentCount: countArray(accumulator.content),
    id: accumulator.id,
    kind: "tool_call_projection",
    kindLabel: accumulator.kind ?? "tool call",
    locationCount: countArray(accumulator.locations),
    preview: nonEmptyPreview(clippedPreview.text),
    statusLabel: accumulator.status ?? "pending",
    summary: summaryForToolCall(textInput),
    title: accumulator.title ?? "Tool call",
    toolCallId: accumulator.toolCallId,
    truncated: clippedPreview.truncated,
    updateCount: accumulator.updateCount,
  };
}

function appendProjectedItem(args: {
  item: TranscriptItem;
  projected: (SessionHistoryProjectedItem | null)[];
  toolCallsById: Map<string, ToolCallAccumulator>;
}): void {
  const data = toolCallData(args.item);
  if (data === null) {
    args.projected.push(args.item);
    return;
  }
  const existing = args.toolCallsById.get(data.toolCallId);
  if (existing !== undefined) {
    mergeAccumulator(existing, data);
    return;
  }
  appendNewToolCall({
    data,
    projected: args.projected,
    toolCallsById: args.toolCallsById,
  });
}

function projectSessionHistoryItems(
  items: TranscriptItem[],
): SessionHistoryProjectedItem[] {
  const projected: (SessionHistoryProjectedItem | null)[] = [];
  const toolCallsById = new Map<string, ToolCallAccumulator>();

  for (const item of items) {
    appendProjectedItem({ item, projected, toolCallsById });
  }

  for (const accumulator of toolCallsById.values()) {
    projected[accumulator.firstIndex] = projectionFromAccumulator(accumulator);
  }

  return projected.filter(
    (item): item is SessionHistoryProjectedItem => item !== null,
  );
}

function isSessionHistoryToolCallProjection(
  item: unknown,
): item is SessionHistoryToolCallProjection {
  return isRecord(item) && item.kind === "tool_call_projection";
}

export {
  TOOL_CALL_PREVIEW_LIMIT,
  isSessionHistoryToolCallProjection,
  projectSessionHistoryItems,
};
export type { SessionHistoryProjectedItem, SessionHistoryToolCallProjection };
