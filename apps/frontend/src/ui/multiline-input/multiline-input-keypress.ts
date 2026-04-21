interface MultilineInputKeyPressEvent {
  preventDefault?: (() => void) | undefined;
  shiftKey?: boolean | undefined;
  nativeEvent: {
    isComposing?: boolean | undefined;
    key: string;
    keyCode?: number | undefined;
    shiftKey?: boolean | undefined;
  };
}

interface HandleMultilineInputKeyPressArgs {
  event: MultilineInputKeyPressEvent;
  onEnterWithoutShift: () => void;
}

function isShiftKeyPressed(event: MultilineInputKeyPressEvent): boolean {
  return event.shiftKey === true || event.nativeEvent.shiftKey === true;
}

function isTextCompositionActive(event: MultilineInputKeyPressEvent): boolean {
  return (
    event.nativeEvent.isComposing === true || event.nativeEvent.keyCode === 229
  );
}

function preventDefaultIfSupported(
  event: MultilineInputKeyPressEvent,
): boolean {
  if (event.preventDefault === undefined) {
    return false;
  }

  event.preventDefault();
  return true;
}

function handleMultilineInputKeyPress({
  event,
  onEnterWithoutShift,
}: HandleMultilineInputKeyPressArgs): void {
  if (event.nativeEvent.key !== "Enter") {
    return;
  }

  if (isShiftKeyPressed(event) || isTextCompositionActive(event)) {
    return;
  }

  if (!preventDefaultIfSupported(event)) {
    return;
  }

  onEnterWithoutShift();
}

export { handleMultilineInputKeyPress };
export type { MultilineInputKeyPressEvent };
