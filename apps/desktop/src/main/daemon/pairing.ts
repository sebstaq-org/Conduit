import QRCode from "qrcode";
import type { DesktopDaemonConfig, DesktopPairingOffer } from "./types.js";
import type { DesktopDaemonController } from "./backend.js";

function mobilePairingUrl(appBaseUrl: string, serviceUrl: string): string {
  const service = new URL(serviceUrl);
  let offer = "";
  if (service.hash.startsWith("#offer=")) {
    offer = service.hash.slice("#offer=".length);
  }
  if (offer.length === 0) {
    throw new Error("service pairing URL did not contain #offer");
  }
  const mobile = new URL(appBaseUrl);
  mobile.searchParams.set("offer", offer);
  return mobile.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function requiredString(value: unknown): string {
  const text = stringValue(value);
  if (text === null) {
    throw new Error("pairing response included invalid string data");
  }
  return text;
}

function readOffer(
  value: Record<string, unknown>,
): DesktopPairingOffer["offer"] {
  if (!isRecord(value.relay)) {
    throw new Error("pairing offer did not include relay material");
  }
  const daemonPublicKeyB64 = requiredString(value.daemonPublicKeyB64);
  const expiresAt = requiredString(value.expiresAt);
  const nonce = requiredString(value.nonce);
  const serverId = requiredString(value.serverId);
  return {
    daemonPublicKeyB64,
    expiresAt,
    nonce,
    relay: {
      clientCapability: requiredString(value.relay.clientCapability),
      endpoint: requiredString(value.relay.endpoint),
      serverId: requiredString(value.relay.serverId),
    },
    serverId,
  };
}

function readPairingPayload(value: unknown): {
  readonly offer: DesktopPairingOffer["offer"];
  readonly url: string;
} {
  if (!isRecord(value) || !isRecord(value.offer)) {
    throw new Error("pairing response did not include an offer");
  }
  const offer = readOffer(value.offer);
  const url = stringValue(value.url);
  if (url === null) {
    throw new Error("pairing response did not include a URL");
  }
  return { offer, url };
}

async function fetchDesktopPairingOffer(
  config: DesktopDaemonConfig,
  daemon: DesktopDaemonController,
): Promise<DesktopPairingOffer> {
  await daemon.waitForStableLifecycle();
  const response = await fetch(`${daemon.serviceUrl}/api/pairing`);
  if (!response.ok) {
    throw new Error(
      `pairing offer failed ${String(response.status)}: ${await response.text()}`,
    );
  }
  const payload = readPairingPayload(await response.json());
  const mobileUrl = mobilePairingUrl(config.appBaseUrl, payload.url);
  return {
    mobileUrl,
    offer: payload.offer,
    qrDataUrl: await QRCode.toDataURL(mobileUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    }),
    serviceUrl: payload.url,
  };
}

export { fetchDesktopPairingOffer, mobilePairingUrl };
