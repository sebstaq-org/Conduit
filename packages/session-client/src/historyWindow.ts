import {
  ConduitProvidersConfigSnapshotResultSchema,
  ConduitSessionHistoryWindowSchema,
  ConduitSessionNewResultSchema,
  ConduitSessionOpenResultSchema,
  ConduitSessionSetConfigOptionResultSchema,
} from "@conduit/app-protocol";
import {
  ProvidersConfigSnapshotResultSchema,
  SessionHistoryWindowSchema,
  SessionNewResultSchema,
  SessionOpenResultSchema,
  SessionSetConfigOptionResultSchema,
} from "@conduit/session-model";
import type {
  ConsumerResponse,
  ProvidersConfigSnapshotResult,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  SessionSetConfigOptionResult,
} from "@conduit/session-contracts";

function readSessionHistoryResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionHistoryWindow | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: SessionHistoryWindowSchema.parse(
      ConduitSessionHistoryWindowSchema.parse(response.result),
    ),
    error: response.error,
  };
}

function readSessionNewResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionNewResult | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: SessionNewResultSchema.parse(
      ConduitSessionNewResultSchema.parse(response.result),
    ),
    error: response.error,
  };
}

function readSessionOpenResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionOpenResult | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: SessionOpenResultSchema.parse(
      ConduitSessionOpenResultSchema.parse(response.result),
    ),
    error: response.error,
  };
}

function readSessionSetConfigOptionResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionSetConfigOptionResult | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: SessionSetConfigOptionResultSchema.parse(
      ConduitSessionSetConfigOptionResultSchema.parse(response.result),
    ),
    error: response.error,
  };
}

function readProvidersConfigSnapshotResponse(
  response: ConsumerResponse,
): ConsumerResponse<ProvidersConfigSnapshotResult | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: ProvidersConfigSnapshotResultSchema.parse(
      ConduitProvidersConfigSnapshotResultSchema.parse(response.result),
    ),
    error: response.error,
  };
}

export {
  readProvidersConfigSnapshotResponse,
  readSessionHistoryResponse,
  readSessionNewResponse,
  readSessionOpenResponse,
  readSessionSetConfigOptionResponse,
};
