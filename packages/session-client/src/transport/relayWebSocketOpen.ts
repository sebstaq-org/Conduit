import { createDeferred } from "./deferred.js";
import { relayCloseError } from "./relayCloseError.js";
import type {
  ConsumerResponse,
} from "@conduit/session-contracts";
import type {
  RelaySessionClientOptions,
  RelayWebSocket,
} from "./relaySessionClientOptions.js";

const relayConnectTimeoutMs = 10_000;
const relayCommandTimeoutMs = 30_000;

type RelayTelemetryEvent = Parameters<
  NonNullable<RelaySessionClientOptions["onTelemetryEvent"]>
>[0];

interface RelaySocketOpenOptions {
  readonly emitTelemetry: (event: RelayTelemetryEvent) => void;
  readonly onConnectFailed: () => void;
}

interface RelaySocketOpenState {
  readonly deferred: PromiseWithResolvers<RelayWebSocket>;
  settled: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
}

interface PendingRelayResponse {
  readonly deferred: PromiseWithResolvers<ConsumerResponse>;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface RelayCommandTimeoutRequest {
  readonly closeSocket: () => void;
  readonly emitTelemetry: (event: RelayTelemetryEvent) => void;
  readonly id: string;
  readonly pending: Map<string, PendingRelayResponse>;
}

function settleOpen(
  state: RelaySocketOpenState,
  task: () => void,
): void {
  if (state.settled) {
    return;
  }
  state.settled = true;
  if (state.timeout !== null) {
    clearTimeout(state.timeout);
  }
  task();
}

function rejectConnectTimeout(
  socket: RelayWebSocket,
  options: RelaySocketOpenOptions,
  state: RelaySocketOpenState,
): void {
  options.onConnectFailed();
  const error = new Error("relay websocket connect timed out");
  options.emitTelemetry({
    event_name: "session_client.relay.socket.connect.finish",
    fields: {
      error,
      error_code: "relay_connect_timeout",
      ok: false,
      timeout_ms: relayConnectTimeoutMs,
    },
    level: "warn",
  });
  socket.close();
  state.deferred.reject(error);
}

function armConnectTimeout(
  socket: RelayWebSocket,
  options: RelaySocketOpenOptions,
  state: RelaySocketOpenState,
): void {
  state.timeout = setTimeout(() => {
    settleOpen(state, () => {
      rejectConnectTimeout(socket, options, state);
    });
  }, relayConnectTimeoutMs);
}

function bindRelaySocketOpenEvents(
  socket: RelayWebSocket,
  options: RelaySocketOpenOptions,
  state: RelaySocketOpenState,
): void {
  socket.addEventListener("open", () => {
    settleOpen(state, () => {
      options.emitTelemetry({
        event_name: "session_client.relay.socket.connect.finish",
        fields: { ok: true },
        level: "info",
      });
      state.deferred.resolve(socket);
    });
  });
  socket.addEventListener("error", (event) => {
    settleOpen(state, () => {
      options.onConnectFailed();
      options.emitTelemetry({
        event_name: "session_client.relay.socket.connect.finish",
        fields: {
          error: event,
          error_code: "socket_connect_failed",
          ok: false,
        },
        level: "warn",
      });
      state.deferred.reject(new Error("relay websocket failed to connect"));
    });
  });
  socket.addEventListener("close", (event: CloseEvent) => {
    settleOpen(state, () => {
      state.deferred.reject(
        relayCloseError(event, "relay websocket closed before open"),
      );
    });
  });
}

async function waitForRelaySocketOpen(
  socket: RelayWebSocket,
  options: RelaySocketOpenOptions,
): Promise<RelayWebSocket> {
  const state: RelaySocketOpenState = {
    deferred: createDeferred<RelayWebSocket>(),
    settled: false,
    timeout: null,
  };
  armConnectTimeout(socket, options, state);
  bindRelaySocketOpenEvents(socket, options, state);
  const openedSocket = await state.deferred.promise;
  return openedSocket;
}

function createPendingRelayResponse(
  onTimeout: () => void,
): PendingRelayResponse {
  const deferred = createDeferred<ConsumerResponse>();
  const timeout = setTimeout(onTimeout, relayCommandTimeoutMs);
  return { deferred, timeout };
}

function rejectRelayCommandTimeout(request: RelayCommandTimeoutRequest): void {
  const pending = request.pending.get(request.id);
  if (pending === undefined) {
    return;
  }
  request.pending.delete(request.id);
  const error = new Error("relay command timed out");
  pending.deferred.reject(error);
  request.emitTelemetry({
    event_name: "session_client.relay.dispatch.timeout",
    fields: {
      command_id: request.id,
      error,
      error_code: "relay_command_timeout",
      ok: false,
      timeout_ms: relayCommandTimeoutMs,
    },
    level: "warn",
  });
  request.closeSocket();
}

export {
  createPendingRelayResponse,
  rejectRelayCommandTimeout,
  relayCommandTimeoutMs,
  relayConnectTimeoutMs,
  waitForRelaySocketOpen,
};
export type { PendingRelayResponse };
