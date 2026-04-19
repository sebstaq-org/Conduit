import {
  acceptConnectionOffer,
  parseConnectionOfferUrl,
} from "@conduit/app-client";
import { conduitApi } from "./api";
import { hostAccepted, hostForgotten, hostPairingFailed } from "./host-registry";
import { activeSessionCleared } from "./session-selection";
import type {
  AcceptConnectionOfferResult,
  ConnectionHostProfile,
} from "@conduit/app-client";
import type { AppDispatch } from "./store";

interface PairHostFromOfferUrlArgs {
  dispatch: AppDispatch;
  hosts: readonly ConnectionHostProfile[];
  offerUrl: string;
}

interface ForgetHostArgs {
  dispatch: AppDispatch;
  serverId: string;
}

function pairingFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Pairing failed";
}

function resetRuntimeView(dispatch: AppDispatch): void {
  dispatch(activeSessionCleared());
  dispatch(conduitApi.util.resetApiState());
}

function dispatchPairingResult(
  dispatch: AppDispatch,
  result: AcceptConnectionOfferResult,
): void {
  if (result.kind === "accepted") {
    resetRuntimeView(dispatch);
    dispatch(hostAccepted(result.host));
    return;
  }
  if (result.kind === "blocked_key_changed") {
    dispatch(hostPairingFailed("Desktop identity changed. Forget the old host first."));
    return;
  }
  dispatch(hostPairingFailed("Desktop is revoked. Forget it before pairing again."));
}

function pairHostFromOfferUrl({
  dispatch,
  hosts,
  offerUrl,
}: PairHostFromOfferUrlArgs): void {
  try {
    const offer = parseConnectionOfferUrl(offerUrl);
    const result = acceptConnectionOffer(offer, hosts);
    dispatchPairingResult(dispatch, result);
  } catch (error) {
    dispatch(hostPairingFailed(pairingFailureMessage(error)));
  }
}

function forgetHost({ dispatch, serverId }: ForgetHostArgs): void {
  dispatch(hostForgotten(serverId));
  resetRuntimeView(dispatch);
}

export { forgetHost, pairHostFromOfferUrl };
