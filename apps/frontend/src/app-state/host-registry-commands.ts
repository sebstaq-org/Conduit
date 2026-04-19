import {
  acceptConnectionOffer,
  parseConnectionOfferUrl,
} from "@conduit/app-client";
import { conduitApi } from "./api";
import { hostAccepted, hostPairingFailed } from "./host-registry";
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

function pairingFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Pairing failed";
}

function dispatchPairingResult(
  dispatch: AppDispatch,
  result: AcceptConnectionOfferResult,
): void {
  if (result.kind === "accepted") {
    dispatch(hostAccepted(result.host));
    dispatch(conduitApi.util.resetApiState());
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

export { pairHostFromOfferUrl };
