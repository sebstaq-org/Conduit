import { useGetRuntimeHealthQuery } from "@/app-state";
import { List, Row, Section } from "@/ui";

const runtimePollingIntervalMs = 5000;

function runtimeHealthErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  return "runtime health request failed";
}

function runtimeStatusLabel(isFetching: boolean): string {
  if (isFetching) {
    return "Runtime recovering";
  }
  return "Runtime degraded";
}

function lastHealthyMeta(checkedAt: string | undefined): string | null {
  if (checkedAt === undefined) {
    return null;
  }
  return `Last healthy at ${checkedAt}`;
}

function RuntimeStatusPanel(): React.JSX.Element | null {
  const runtimeHealth = useGetRuntimeHealthQuery(undefined, {
    pollingInterval: runtimePollingIntervalMs,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  if (!runtimeHealth.isError) {
    return null;
  }

  function handleRetry(): void {
    void runtimeHealth.refetch();
  }

  const statusLabel = runtimeStatusLabel(runtimeHealth.isFetching);
  const statusMeta = runtimeHealthErrorMessage(runtimeHealth.error);
  const lastHealthy = lastHealthyMeta(runtimeHealth.data?.checkedAt);

  return (
    <Section title="Runtime">
      <List>
        <Row label={statusLabel} meta={statusMeta} />
        {lastHealthy !== null && <Row label={lastHealthy} muted />}
        <Row label="Retry now" onPress={handleRetry} />
      </List>
    </Section>
  );
}

export { RuntimeStatusPanel };
