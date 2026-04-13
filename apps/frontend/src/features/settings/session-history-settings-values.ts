const MIN_LOOKBACK_DAYS = 1;
const MAX_LOOKBACK_DAYS = 365;

function parseLookbackDays(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_LOOKBACK_DAYS ||
    parsed > MAX_LOOKBACK_DAYS
  ) {
    return undefined;
  }
  return parsed;
}

function lookbackDraftValue(
  draft: string | null,
  persisted: number | null | undefined,
): string {
  if (draft !== null) {
    return draft;
  }
  if (persisted === null || persisted === undefined) {
    return "";
  }
  return String(persisted);
}

export { lookbackDraftValue, parseLookbackDays };
