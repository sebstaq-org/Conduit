interface DesktopDaemonConfig {
  readonly appBaseUrl: string;
  readonly backendHost: string;
  readonly backendLogPath: string;
  readonly backendPort: number;
  readonly home: string;
  readonly providerFixtures: string | null;
  readonly relayEndpoint: string;
  readonly serviceBinPath: string;
  readonly storePath: string | null;
}

interface DesktopDaemonStatus {
  readonly appBaseUrl: string;
  readonly backendHealthy: boolean;
  readonly daemon: {
    readonly pairingConfigured: boolean;
    readonly relayEndpoint: string | null;
    readonly serverId: string;
  } | null;
  readonly lastExit: string | null;
  readonly pairingConfigured: boolean;
  readonly pid: number | null;
  readonly relayConfigured: boolean;
  readonly relayEndpoint: string | null;
  readonly restartCount: number;
  readonly running: boolean;
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

export type { DesktopDaemonConfig, DesktopDaemonStatus, DesktopPairingOffer };
