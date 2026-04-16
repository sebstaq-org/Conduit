import type {
  ContentBlock as ProtocolContentBlock,
  TranscriptItem as ProtocolTranscriptItem,
} from "@conduit/app-protocol";
import type {
  EventTranscriptItem,
  MessageTranscriptItem,
  TranscriptContentPart,
  TranscriptItem,
} from "./models";

function mapTranscriptContentPart(
  value: ProtocolContentBlock,
): TranscriptContentPart {
  if (value.type === "text") {
    const text = value.text;
    if (typeof text === "string") {
      return {
        kind: "text",
        text,
      };
    }
  }
  return {
    kind: "unsupported",
    type: value.type,
  };
}

function applyOptionalTranscriptFields<
  Item extends {
    status?: TranscriptItem["status"];
    stopReason?: string | null;
    turnId?: string | null;
  },
>(source: ProtocolTranscriptItem, target: Item): Item {
  if (source.status !== undefined) {
    target.status = source.status;
  }
  if (source.stopReason !== undefined) {
    target.stopReason = source.stopReason;
  }
  if (source.turnId !== undefined) {
    target.turnId = source.turnId;
  }
  return target;
}

function mapMessageTranscriptItem(
  item: Extract<ProtocolTranscriptItem, { kind: "message" }>,
): MessageTranscriptItem {
  return applyOptionalTranscriptFields<MessageTranscriptItem>(item, {
    content: item.content.map((value) => mapTranscriptContentPart(value)),
    id: item.id,
    kind: "message",
    role: item.role,
  });
}

function mapEventTranscriptItem(
  item: Extract<ProtocolTranscriptItem, { kind: "event" }>,
): EventTranscriptItem {
  return applyOptionalTranscriptFields<EventTranscriptItem>(item, {
    data: item.data,
    id: item.id,
    kind: "event",
    variant: item.variant,
  });
}

function mapTranscriptItem(item: ProtocolTranscriptItem): TranscriptItem {
  if (item.kind === "message") {
    return mapMessageTranscriptItem(item);
  }
  return mapEventTranscriptItem(item);
}

export { mapTranscriptItem };
