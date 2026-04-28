function errorFields(error: Error): Record<string, string | null> {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack ?? null,
  };
}

const MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = "[redacted]";
const TRUNCATED_SUFFIX = "...[truncated]";

const SENSITIVE_FIELD_PATTERN =
  /(^|[_-])(authorization|bearer|capability|cookie|credential|password|private[_-]?key|secret|token)([_-]|$)|^(auth|content|input|prompt|text)$/i;

const SENSITIVE_STRING_PATTERNS = [
  /#offer=/i,
  /\bauthorization:\s*bearer\s+[a-z0-9._~+/=-]+/i,
  /\bbearer\s+[a-z0-9._~+/=-]+/i,
  /\b(client|daemon|route)[_-]?capability=([a-z0-9._~+/=-]+)/i,
] as const;

function redactString(value: string): string {
  if (SENSITIVE_STRING_PATTERNS.some((pattern) => pattern.test(value))) {
    return REDACTED_VALUE;
  }
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}${TRUNCATED_SUFFIX}`;
}

function shouldRedactField(key: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(key);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  try {
    const serialized = JSON.stringify(
      value,
      (key: string, current: unknown) => {
        if (key.length > 0 && shouldRedactField(key)) {
          return REDACTED_VALUE;
        }
        if (current instanceof Error) {
          return errorFields(current);
        }
        if (typeof current === "bigint") {
          return current.toString();
        }
        if (typeof current === "string") {
          return redactString(current);
        }
        return current;
      },
    );
    if (serialized === undefined) {
      return null;
    }
    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof Error) {
      return errorFields(error);
    }
    return String(error);
  }
}

function sanitizeLogField(key: string, value: unknown): unknown {
  if (shouldRedactField(key)) {
    return REDACTED_VALUE;
  }
  return sanitizeUnknown(value);
}

export { sanitizeLogField, sanitizeUnknown };
