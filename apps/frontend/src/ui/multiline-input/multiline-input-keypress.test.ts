import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { handleMultilineInputKeyPress } from "./multiline-input-keypress";
import type { MultilineInputKeyPressEvent } from "./multiline-input-keypress";

interface CreateKeyPressEventArgs {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
  shiftKey?: boolean;
  withPreventDefault?: boolean;
}

function createNativeEvent(
  args: CreateKeyPressEventArgs,
): MultilineInputKeyPressEvent["nativeEvent"] {
  const nativeEvent: MultilineInputKeyPressEvent["nativeEvent"] = {
    key: args.key ?? "Enter",
  };

  if (args.isComposing !== undefined) {
    nativeEvent.isComposing = args.isComposing;
  }

  if (args.keyCode !== undefined) {
    nativeEvent.keyCode = args.keyCode;
  }

  if (args.shiftKey !== undefined) {
    nativeEvent.shiftKey = args.shiftKey;
  }

  return nativeEvent;
}

function createEvent(
  args: CreateKeyPressEventArgs,
  preventDefault: () => void,
): MultilineInputKeyPressEvent {
  const event: MultilineInputKeyPressEvent = {
    nativeEvent: createNativeEvent(args),
  };

  if (args.shiftKey !== undefined) {
    event.shiftKey = args.shiftKey;
  }

  if (args.withPreventDefault !== false) {
    event.preventDefault = preventDefault;
  }

  return event;
}

interface CreatedKeyPressEvent {
  event: MultilineInputKeyPressEvent;
  preventDefault: Mock<() => void> | null;
}

function createKeyPressEvent(
  args: CreateKeyPressEventArgs = {},
): CreatedKeyPressEvent {
  const preventDefault = vi.fn<() => void>();

  if (args.withPreventDefault === false) {
    return {
      event: createEvent(args, preventDefault),
      preventDefault: null,
    };
  }

  return {
    event: createEvent(args, preventDefault),
    preventDefault,
  };
}

describe("multiline input submit keypress", () => {
  it("submits on enter without shift", () => {
    const onEnterWithoutShift = vi.fn<() => void>();
    const { event, preventDefault } = createKeyPressEvent();

    handleMultilineInputKeyPress({ event, onEnterWithoutShift });

    expect(onEnterWithoutShift.mock.calls).toHaveLength(1);
    expect(preventDefault?.mock.calls).toHaveLength(1);
  });

  it("keeps shift-enter for a newline", () => {
    const onEnterWithoutShift = vi.fn<() => void>();
    const { event, preventDefault } = createKeyPressEvent({ shiftKey: true });

    handleMultilineInputKeyPress({ event, onEnterWithoutShift });

    expect(onEnterWithoutShift).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("ignores enter while text composition is active", () => {
    const onEnterWithoutShift = vi.fn<() => void>();
    const { event, preventDefault } = createKeyPressEvent({
      isComposing: true,
    });

    handleMultilineInputKeyPress({ event, onEnterWithoutShift });

    expect(onEnterWithoutShift).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("does not submit when preventDefault is unavailable", () => {
    const onEnterWithoutShift = vi.fn<() => void>();
    const { event } = createKeyPressEvent({ withPreventDefault: false });

    handleMultilineInputKeyPress({ event, onEnterWithoutShift });

    expect(onEnterWithoutShift).not.toHaveBeenCalled();
  });
});
