function errorFields(error: Error): Record<string, string | null> {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack ?? null,
  };
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  try {
    const serialized = JSON.stringify(
      value,
      (_key: string, current: unknown) => {
        if (current instanceof Error) {
          return errorFields(current);
        }
        if (typeof current === "bigint") {
          return current.toString();
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

export { sanitizeUnknown };
