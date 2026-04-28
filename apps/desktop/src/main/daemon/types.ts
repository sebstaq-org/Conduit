interface DesktopDaemonConfig {
  readonly appBaseUrl: string;
  readonly backendHost: string;
  readonly backendLogPath: string;
  readonly backendPidPath: string | null;
  readonly backendPort: number;
  readonly frontend:
    | {
        readonly kind: "static";
        readonly webDir: string;
      }
    | {
        readonly kind: "url";
        readonly url: string;
      };
  readonly home: string;
  readonly logProfile: "dev" | "stage";
  readonly providerFixtures: string | null;
  readonly relayEndpoint: string;
  readonly serviceBinPath: string;
  readonly storePath: string | null;
}

interface DesktopPresenceClient {
  readonly clientId: string;
  readonly connected: boolean;
  readonly deviceKind: "mobile" | "web";
  readonly displayName: string;
  readonly lastSeenAt: string;
  readonly transport: "direct" | "relay";
}

interface DesktopPresenceSnapshot {
  readonly clients: DesktopPresenceClient[];
  readonly host: {
    readonly displayName: string;
    readonly serverId: string;
  };
}

type DesktopMobileConnectionStatus =
  | "idle"
  | "waiting"
  | "connected"
  | "reconnecting"
  | "disconnected";

interface DesktopMobileConnection {
  readonly connectionId: string | null;
  readonly generation: number | null;
  readonly lastError: string | null;
  readonly staleAt: string | null;
  readonly status: DesktopMobileConnectionStatus;
  readonly transport: "relay";
  readonly verifiedAt: string | null;
}

interface DesktopDaemonStatus {
  readonly appBaseUrl: string;
  readonly backendHealthy: boolean;
  readonly daemon: {
    readonly mobileConnection: DesktopMobileConnection;
    readonly pairingConfigured: boolean;
    readonly presence: DesktopPresenceSnapshot;
    readonly relayEndpoint: string | null;
    readonly serverId: string;
  } | null;
  readonly lastExit: string | null;
  readonly mobileConnection: DesktopMobileConnection;
  readonly pairingConfigured: boolean;
  readonly pid: number | null;
  readonly presence: DesktopPresenceSnapshot | null;
  readonly relayConfigured: boolean;
  readonly relayEndpoint: string | null;
  readonly restartCount: number;
  readonly running: boolean;
  readonly sessionWsUrl: string | null;
}

interface DesktopRuntimeConfig {
  readonly clientLogUrl?: string;
  readonly logProfile?: string;
  readonly runtimeSurface?: string;
  readonly sessionWsUrl?: string;
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

export type {
  DesktopDaemonConfig,
  DesktopDaemonStatus,
  DesktopMobileConnection,
  DesktopMobileConnectionStatus,
  DesktopPairingOffer,
  DesktopPresenceClient,
  DesktopPresenceSnapshot,
  DesktopRuntimeConfig,
};
