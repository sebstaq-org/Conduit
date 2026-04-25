import { publicKeyFingerprint } from "@conduit/app-client";
import { ConnectionStatusIndicator, Row } from "@/ui";
import type {
  ConnectedHostRowsArgs,
  HostStatusRowsProps,
} from "./host-pairing-types";

function renderHostKeyRow(fingerprint: string): React.JSX.Element {
  return <Row label={`Key ${fingerprint}`} muted />;
}

function renderHostErrorRow(message: string | null): React.JSX.Element | null {
  if (message === null) {
    return null;
  }
  return <Row label={message} muted />;
}

function renderConnectedHostRows({
  activeHost,
  connectionError,
  connectionIndicator,
  connectionReason,
  connectionStatus,
  onForget,
}: ConnectedHostRowsArgs): React.JSX.Element {
  const fingerprint = publicKeyFingerprint(
    activeHost.trustedDaemonPublicKeyB64,
  );
  return (
    <>
      <Row
        label={connectionStatus}
        leading={
          <ConnectionStatusIndicator
            label={`${connectionStatus} ${connectionIndicator} indicator`}
            status={connectionIndicator}
          />
        }
        meta={activeHost.displayName}
      />
      <Row label={connectionReason} muted />
      {renderHostKeyRow(fingerprint)}
      {renderHostErrorRow(connectionError)}
      <Row label="Forget desktop" onPress={onForget} />
    </>
  );
}

function HostStatusRows({
  activeHost,
  connectionError,
  connectionIndicator,
  connectionReason,
  connectionStatus,
  onForget,
}: HostStatusRowsProps): React.JSX.Element {
  if (activeHost === null) {
    return (
      <Row
        label="Desktop"
        leading={
          <ConnectionStatusIndicator
            label="Desktop idle indicator"
            status="idle"
          />
        }
        meta="No desktop paired"
        muted
      />
    );
  }
  return renderConnectedHostRows({
    activeHost,
    connectionError,
    connectionIndicator,
    connectionReason,
    connectionStatus,
    onForget,
  });
}

export { HostStatusRows };
