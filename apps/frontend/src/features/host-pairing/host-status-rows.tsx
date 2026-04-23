import { publicKeyFingerprint } from "@conduit/app-client";
import { Row } from "@/ui";
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
  connectionStatus,
  onForget,
}: ConnectedHostRowsArgs): React.JSX.Element {
  const fingerprint = publicKeyFingerprint(
    activeHost.trustedDaemonPublicKeyB64,
  );
  return (
    <>
      <Row label={connectionStatus} meta={activeHost.serverId} />
      {renderHostKeyRow(fingerprint)}
      {renderHostErrorRow(connectionError)}
      <Row label="Forget desktop" onPress={onForget} />
    </>
  );
}

function HostStatusRows({
  activeHost,
  connectionError,
  connectionStatus,
  onForget,
}: HostStatusRowsProps): React.JSX.Element {
  if (activeHost === null) {
    return <Row label="No desktop paired" muted />;
  }
  return renderConnectedHostRows({
    activeHost,
    connectionError,
    connectionStatus,
    onForget,
  });
}

export { HostStatusRows };
