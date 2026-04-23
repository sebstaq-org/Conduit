import type { ConnectionHostProfile } from "@conduit/app-client";
import type { ConnectionStatusKind } from "@/ui";

interface HostPairingPanelProps {
  initialOfferUrl?: string | undefined;
}

interface PairingFormProps {
  offerUrl: string;
  onConnect: () => void;
  onOfferUrlChange: (value: string) => void;
  pairingError: string | null;
}

interface HostStatusRowsProps {
  activeHost: ConnectionHostProfile | null;
  connectionError: string | null;
  connectionIndicator: ConnectionStatusKind;
  connectionReason: string;
  connectionStatus: string;
  onForget: () => void;
}

interface ConnectedHostRowsArgs {
  activeHost: ConnectionHostProfile;
  connectionError: string | null;
  connectionIndicator: ConnectionStatusKind;
  connectionReason: string;
  connectionStatus: string;
  onForget: () => void;
}

interface HostPairingListProps extends HostStatusRowsProps, PairingFormProps {}

export type {
  ConnectedHostRowsArgs,
  HostPairingListProps,
  HostPairingPanelProps,
  HostStatusRowsProps,
  PairingFormProps,
};
