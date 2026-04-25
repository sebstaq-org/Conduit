import type { RelayCipherFrame } from "@conduit/relay-transport";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRelayCipherFrame(value: unknown): RelayCipherFrame {
  if (!isRecord(value)) {
    throw new Error("relay cipher frame must be an object");
  }
  const v = value.v;
  const type = value.type;
  const sender = value.sender;
  const seq = value.seq;
  const ciphertextB64 = value.ciphertextB64;
  if (
    v !== 1 ||
    type !== "ciphertext" ||
    (sender !== "client" && sender !== "server") ||
    typeof seq !== "number" ||
    typeof ciphertextB64 !== "string"
  ) {
    throw new Error("relay cipher frame is invalid");
  }
  return { ciphertextB64, sender, seq, type, v };
}

export { readRelayCipherFrame };
