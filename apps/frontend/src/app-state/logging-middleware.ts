import type { Middleware } from "@reduxjs/toolkit";
import { logDebug, logInfo, logWarn } from "./frontend-logger";
import { appendRejectedFields } from "./logging-middleware-rejections";

interface PendingRequestContext {
  endpointName: string;
  originalArgs: unknown;
  requestKind: string;
  startedAt: number;
}

interface ApiLifecycleAction {
  actionMeta: Record<string, unknown> | null;
  actionType: string;
  endpointName: string;
  error: unknown;
  originalArgs: unknown;
  payload: unknown;
  phase: "pending" | "fulfilled" | "rejected";
  requestId: string;
  requestKind: string;
}

interface ApiRequestContext {
  endpointName: string;
  originalArgs: unknown;
  requestId: string;
  requestKind: string;
}

const pendingRequests = new Map<string, PendingRequestContext>();

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
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
}

function readActionType(action: unknown): string | null {
  if (!isObjectRecord(action)) {
    return null;
  }
  return readStringField(action, "type");
}

function parseSessionSelectionAction(
  action: unknown,
): Record<string, unknown> | null {
  const actionType = readActionType(action);
  if (actionType === null || !actionType.startsWith("sessionSelection/")) {
    return null;
  }
  if (!isObjectRecord(action)) {
    return null;
  }
  return {
    action_payload: action.payload ?? null,
    action_type: actionType,
  };
}

function logSessionSelectionAction(action: unknown): void {
  const parsed = parseSessionSelectionAction(action);
  if (parsed === null) {
    return;
  }
  logInfo("frontend.intent.action", parsed);
}

function readApiPhase(type: string): ApiLifecycleAction["phase"] | null {
  if (type.endsWith("/pending")) {
    return "pending";
  }
  if (type.endsWith("/fulfilled")) {
    return "fulfilled";
  }
  if (type.endsWith("/rejected")) {
    return "rejected";
  }
  return null;
}

function readApiArg(
  meta: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!isObjectRecord(meta.arg)) {
    return null;
  }
  return meta.arg;
}

function readRequestKind(arg: Record<string, unknown>): string {
  return readStringField(arg, "type") ?? "unknown";
}

function readEndpointName(arg: Record<string, unknown>): string | null {
  return readStringField(arg, "endpointName");
}

function readRequestId(meta: Record<string, unknown>): string | null {
  return readStringField(meta, "requestId");
}

function readActionMeta(action: unknown): Record<string, unknown> | null {
  if (!isObjectRecord(action) || !isObjectRecord(action.meta)) {
    return null;
  }
  return action.meta;
}

function readApiIdentifiers(meta: Record<string, unknown>): {
  arg: Record<string, unknown>;
  requestId: string;
} | null {
  const requestId = readRequestId(meta);
  const arg = readApiArg(meta);
  if (requestId === null || arg === null) {
    return null;
  }
  return { arg, requestId };
}

function readApiRequestContext(action: unknown): ApiRequestContext | null {
  const meta = readActionMeta(action);
  if (meta === null) {
    return null;
  }
  const identifiers = readApiIdentifiers(meta);
  if (identifiers === null) {
    return null;
  }
  const endpointName = readEndpointName(identifiers.arg);
  if (endpointName === null) {
    return null;
  }
  return {
    endpointName,
    originalArgs: identifiers.arg.originalArgs ?? null,
    requestId: identifiers.requestId,
    requestKind: readRequestKind(identifiers.arg),
  };
}

function parseApiLifecycleAction(action: unknown): ApiLifecycleAction | null {
  const actionType = readActionType(action);
  if (actionType === null || !actionType.startsWith("conduitApi/execute")) {
    return null;
  }
  const phase = readApiPhase(actionType);
  const context = readApiRequestContext(action);
  if (phase === null || context === null || !isObjectRecord(action)) {
    return null;
  }
  return {
    actionMeta: readActionMeta(action),
    actionType,
    endpointName: context.endpointName,
    error: action.error ?? null,
    originalArgs: context.originalArgs,
    payload: action.payload ?? null,
    phase,
    requestId: context.requestId,
    requestKind: context.requestKind,
  };
}

function logApiPending(action: ApiLifecycleAction): void {
  pendingRequests.set(action.requestId, {
    endpointName: action.endpointName,
    originalArgs: action.originalArgs,
    requestKind: action.requestKind,
    startedAt: Date.now(),
  });
  logDebug("frontend.api.lifecycle.start", {
    endpoint_name: action.endpointName,
    request_args: action.originalArgs,
    request_id: action.requestId,
    request_kind: action.requestKind,
  });
}

function buildLifecycleFields(
  action: ApiLifecycleAction,
  context: PendingRequestContext | undefined,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    duration_ms: Date.now() - (context?.startedAt ?? Date.now()),
    endpoint_name: action.endpointName,
    request_id: action.requestId,
    response_payload: action.payload,
  };
  if (context === undefined) {
    fields.request_args = action.originalArgs;
    fields.request_kind = action.requestKind;
    return fields;
  }
  fields.request_args = context.originalArgs;
  fields.request_kind = context.requestKind;
  return fields;
}

function logApiFinish(
  action: ApiLifecycleAction,
  context: PendingRequestContext | undefined,
): void {
  const fields = buildLifecycleFields(action, context);
  if (action.phase === "fulfilled") {
    fields.ok = true;
    logInfo("frontend.api.lifecycle.finish", fields);
    return;
  }
  appendRejectedFields(fields, action);
  logWarn("frontend.api.lifecycle.finish", fields);
}

function logApiLifecycleAction(action: unknown): void {
  const parsed = parseApiLifecycleAction(action);
  if (parsed === null) {
    return;
  }
  if (parsed.phase === "pending") {
    logApiPending(parsed);
    return;
  }
  const context = pendingRequests.get(parsed.requestId);
  pendingRequests.delete(parsed.requestId);
  logApiFinish(parsed, context);
}

const frontendLoggingMiddleware: Middleware = () => (next) => (action) => {
  const result = next(action);
  logSessionSelectionAction(action);
  logApiLifecycleAction(action);
  return result;
};

export { frontendLoggingMiddleware };
