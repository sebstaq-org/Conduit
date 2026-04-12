import type { SessionClientPort } from "@conduit/session-client";

type DispatchLike = (action: unknown) => unknown;
type InvalidateSessionGroups = (dispatch: DispatchLike) => void;

interface SubscriptionContext {
  client: SessionClientPort;
  dispatch: DispatchLike;
  invalidate: InvalidateSessionGroups;
}

async function subscribeSessionIndexProvider(
  context: SubscriptionContext,
): Promise<() => void> {
  const subscription = await context.client.subscribeSessionIndexChanges(() => {
    context.invalidate(context.dispatch);
  });
  return subscription;
}

async function subscribeSessionIndexInvalidation(
  client: SessionClientPort,
  dispatch: DispatchLike,
  invalidate: InvalidateSessionGroups,
): Promise<(() => void)[]> {
  const context = { client, dispatch, invalidate };
  const subscription = await subscribeSessionIndexProvider(context);
  return [subscription];
}

export { subscribeSessionIndexInvalidation };
