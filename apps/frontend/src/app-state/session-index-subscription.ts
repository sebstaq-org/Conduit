import type { ProviderId, SessionClientPort } from "@conduit/session-client";

type DispatchLike = (action: unknown) => unknown;
type InvalidateSessionGroups = (dispatch: DispatchLike) => void;

interface SubscriptionContext {
  client: SessionClientPort;
  dispatch: DispatchLike;
  invalidate: InvalidateSessionGroups;
}

async function subscribeSessionIndexProvider(
  context: SubscriptionContext,
  provider: ProviderId,
): Promise<() => void> {
  const subscription = await context.client.subscribeSessionIndexChanges(
    provider,
    () => {
      context.invalidate(context.dispatch);
    },
  );
  return subscription;
}

async function subscribeSessionIndexInvalidation(
  client: SessionClientPort,
  dispatch: DispatchLike,
  invalidate: InvalidateSessionGroups,
): Promise<(() => void)[]> {
  const context = { client, dispatch, invalidate };
  const subscriptions = await Promise.all([
    subscribeSessionIndexProvider(context, "claude"),
    subscribeSessionIndexProvider(context, "copilot"),
    subscribeSessionIndexProvider(context, "codex"),
  ]);
  return subscriptions;
}

export { subscribeSessionIndexInvalidation };
