interface DesktopDaemonStatus {
  readonly appBaseUrl: string;
  readonly backendHealthy: boolean;
  readonly daemon: {
    readonly mobilePeerConnected: boolean;
    readonly pairingConfigured: boolean;
    readonly relayEndpoint: string | null;
    readonly serverId: string;
  } | null;
  readonly lastExit: string | null;
  readonly mobilePeerConnected: boolean;
  readonly pairingConfigured: boolean;
  readonly pid: number | null;
  readonly relayConfigured: boolean;
  readonly relayEndpoint: string | null;
  readonly restartCount: number;
  readonly running: boolean;
  readonly sessionWsUrl: string | null;
}

interface DesktopPairingOffer {
  readonly mobileUrl: string;
  readonly offer: {
    readonly daemonPublicKeyB64: string;
    readonly expiresAt: string;
    readonly nonce: string;
    readonly relay: {
      readonly clientCapability: string;
      readonly endpoint: string;
      readonly serverId: string;
    };
    readonly serverId: string;
  };
  readonly qrDataUrl: string;
  readonly serviceUrl: string;
}

interface ConduitDesktopBridge {
  copyText(value: string): Promise<boolean>;
  getDaemonStatus(): Promise<DesktopDaemonStatus>;
  getPairingOffer(): Promise<DesktopPairingOffer>;
  restartDaemon(): Promise<DesktopDaemonStatus>;
}

declare global {
  var conduitDesktop: ConduitDesktopBridge | undefined;
}

function desktopBridge(): ConduitDesktopBridge | null {
  return globalThis.conduitDesktop ?? null;
}

function desktopBridgeAvailable(): boolean {
  return desktopBridge() !== null;
}

export { desktopBridge, desktopBridgeAvailable };
export type { ConduitDesktopBridge, DesktopDaemonStatus, DesktopPairingOffer };
