import {
  ProvidersConfigSnapshotResultSchema,
  SessionHistoryWindowSchema,
  SessionNewResultSchema,
  SessionOpenResultSchema,
  SessionSetConfigOptionResultSchema,
} from "@conduit/app-protocol";
import type {
  ConsumerResponse,
  ProvidersConfigSnapshotResult,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  SessionSetConfigOptionResult,
} from "@conduit/app-protocol";

interface ResultSchema<Result> {
  parse(value: unknown): Result;
}

function readConsumerResult<Result>(args: {
  fallbackMessage: string;
  response: ConsumerResponse;
  schema: ResultSchema<Result>;
}): Result {
  if (!args.response.ok) {
    throw new Error(args.response.error?.message ?? args.fallbackMessage);
  }
  return args.schema.parse(args.response.result);
}

function readSessionHistoryResponse(
  response: ConsumerResponse,
): SessionHistoryWindow {
  return readConsumerResult({
    fallbackMessage: "session history failed",
    response,
    schema: SessionHistoryWindowSchema,
  });
}

function readSessionNewResponse(response: ConsumerResponse): SessionNewResult {
  return readConsumerResult({
    fallbackMessage: "session new failed",
    response,
    schema: SessionNewResultSchema,
  });
}

function readSessionOpenResponse(
  response: ConsumerResponse,
): SessionOpenResult {
  return readConsumerResult({
    fallbackMessage: "session open failed",
    response,
    schema: SessionOpenResultSchema,
  });
}

function readSessionSetConfigOptionResponse(
  response: ConsumerResponse,
): SessionSetConfigOptionResult {
  return readConsumerResult({
    fallbackMessage: "session set_config_option failed",
    response,
    schema: SessionSetConfigOptionResultSchema,
  });
}

function readProvidersConfigSnapshotResponse(
  response: ConsumerResponse,
): ProvidersConfigSnapshotResult {
  return readConsumerResult({
    fallbackMessage: "providers config snapshot failed",
    response,
    schema: ProvidersConfigSnapshotResultSchema,
  });
}

export {
  readProvidersConfigSnapshotResponse,
  readSessionHistoryResponse,
  readSessionNewResponse,
  readSessionOpenResponse,
  readSessionSetConfigOptionResponse,
};
