interface ApiLifecycleRejection {
  actionMeta: Record<string, unknown> | null;
  actionType: string;
  error: unknown;
  payload: unknown;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return true;
}

function readStringField(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
}

function readBooleanField(
  record: Record<string, unknown>,
  field: string,
): boolean | null {
  const value = record[field];
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function readIssueField(
  issue: Record<string, unknown>,
  field: string,
): unknown {
  if (!(field in issue)) {
    return null;
  }
  return issue[field];
}

function readIssueString(
  issue: Record<string, unknown>,
  field: string,
): string | null {
  const value = readIssueField(issue, field);
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function readIssuePath(issue: Record<string, unknown>): unknown[] | null {
  const value = readIssueField(issue, "path");
  if (!Array.isArray(value)) {
    return null;
  }
  const path: unknown[] = [];
  for (const segment of value) {
    path.push(segment);
  }
  return path;
}

function toUnknownArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: unknown[] = [];
  for (const item of value) {
    items.push(item);
  }
  return items;
}

function parseIssuePayload(payload: unknown): unknown[] | null {
  if (typeof payload !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    return toUnknownArray(parsed);
  } catch {
    return null;
  }
}

function issueFieldsFromFirstIssue(
  issue: unknown,
  issueCount: number,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    validation_issue_count: issueCount,
  };
  if (!isObjectRecord(issue)) {
    return fields;
  }
  fields.validation_issue_code = readIssueString(issue, "code");
  fields.validation_issue_message = readIssueString(issue, "message");
  fields.validation_issue_path = readIssuePath(issue);
  return fields;
}

function issueFieldsFromPayload(
  payload: unknown,
): Record<string, unknown> | null {
  const parsed = parseIssuePayload(payload);
  if (parsed === null || parsed.length === 0) {
    return null;
  }
  return issueFieldsFromFirstIssue(parsed[0], parsed.length);
}

function appendErrorFields(
  fields: Record<string, unknown>,
  error: unknown,
): void {
  if (!isObjectRecord(error)) {
    return;
  }
  fields.error_name = readStringField(error, "name");
  fields.error_message = readStringField(error, "message");
  fields.error_code_field = readStringField(error, "code");
}

function appendIssueFields(
  fields: Record<string, unknown>,
  payload: unknown,
): void {
  const parsedIssues = issueFieldsFromPayload(payload);
  if (parsedIssues === null) {
    return;
  }
  for (const [key, value] of Object.entries(parsedIssues)) {
    fields[key] = value;
  }
}

function appendActionMetaFields(
  fields: Record<string, unknown>,
  actionMeta: Record<string, unknown> | null,
): void {
  if (actionMeta === null) {
    return;
  }
  fields.rejected_aborted = readBooleanField(actionMeta, "aborted");
  fields.rejected_condition = readBooleanField(actionMeta, "condition");
  fields.rejected_with_value = readBooleanField(
    actionMeta,
    "rejectedWithValue",
  );
}

function payloadType(payload: unknown): string {
  if (payload === null) {
    return "null";
  }
  return typeof payload;
}

function appendRejectedFields(
  fields: Record<string, unknown>,
  action: ApiLifecycleRejection,
): void {
  fields.error = action.error;
  fields.error_code = "query_rejected";
  fields.ok = false;
  fields.rejection_action_type = action.actionType;
  fields.response_payload_type = payloadType(action.payload);
  appendErrorFields(fields, action.error);
  appendIssueFields(fields, action.payload);
  appendActionMetaFields(fields, action.actionMeta);
}

export { appendRejectedFields };
