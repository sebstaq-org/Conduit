interface ConnectionOfferRelay {
  endpoint: string;
  serverId: string;
  clientCapability: string;
}

type ConnectionOfferV1 = Record<"v", 1> & {
  serverId: string;
  daemonPublicKeyB64: string;
  nonce: string;
  expiresAt: string;
  authorization: {
    required: true;
    boundary: "relay-handshake";
  };
  relay: ConnectionOfferRelay;
};

interface TrustedHostRecord {
  displayName: string;
  serverId: string;
  trustedDaemonPublicKeyB64: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

interface ConnectionHostProfile extends TrustedHostRecord {
  createdAt: string;
  offerNonce: string;
  relay: ConnectionOfferRelay;
}

type ConnectionOfferTrustResult =
  | { kind: "new_host"; offer: ConnectionOfferV1 }
  | { kind: "known_host"; offer: ConnectionOfferV1; host: TrustedHostRecord }
  | { kind: "key_changed"; offer: ConnectionOfferV1; host: TrustedHostRecord }
  | { kind: "revoked_host"; offer: ConnectionOfferV1; host: TrustedHostRecord };

type AcceptConnectionOfferResult =
  | {
      kind: "accepted";
      host: ConnectionHostProfile;
      trust: "new_host" | "known_host";
    }
  | {
      kind: "blocked_key_changed";
      offer: ConnectionOfferV1;
      host: TrustedHostRecord;
    }
  | {
      kind: "blocked_revoked";
      offer: ConnectionOfferV1;
      host: TrustedHostRecord;
    };

export type {
  AcceptConnectionOfferResult,
  ConnectionHostProfile,
  ConnectionOfferRelay,
  ConnectionOfferTrustResult,
  ConnectionOfferV1,
  TrustedHostRecord,
};
