const standardAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const urlAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64(bytes: Uint8Array, urlSafe: boolean): string {
  const alphabet = urlSafe ? urlAlphabet : standardAlphabet;
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const packed = first * 65_536 + second * 256 + third;
    output += alphabet[Math.floor(packed / 262_144) % 64] ?? "";
    output += alphabet[Math.floor(packed / 4096) % 64] ?? "";
    output +=
      index + 1 < bytes.length
        ? (alphabet[Math.floor(packed / 64) % 64] ?? "")
        : "=";
    output += index + 2 < bytes.length ? (alphabet[packed % 64] ?? "") : "=";
  }
  return urlSafe ? output.replaceAll("=", "") : output;
}

function decodeBase64(value: string, urlSafe: boolean): Uint8Array {
  const alphabet = urlSafe ? urlAlphabet : standardAlphabet;
  const normalized = urlSafe
    ? value.replaceAll("-", "+").replaceAll("_", "/")
    : value;
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${"=".repeat(paddingLength)}`;
  const output: number[] = [];
  for (let index = 0; index < padded.length; index += 4) {
    const chunk = padded.slice(index, index + 4);
    const values = Array.from(chunk).map((character) =>
      character === "=" ? 0 : alphabet.indexOf(character),
    );
    if (values.some((byte) => byte < 0)) {
      throw new Error("invalid base64 relay value");
    }
    const first = values[0] ?? 0;
    const second = values[1] ?? 0;
    const third = values[2] ?? 0;
    const fourth = values[3] ?? 0;
    const packed = first * 262_144 + second * 4096 + third * 64 + fourth;
    output.push(Math.floor(packed / 65_536) % 256);
    if (chunk[2] !== "=") {
      output.push(Math.floor(packed / 256) % 256);
    }
    if (chunk[3] !== "=") {
      output.push(packed % 256);
    }
  }
  return Uint8Array.from(output);
}

export function encodeStandardBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes, false);
}

export function decodeStandardBase64(value: string): Uint8Array {
  return decodeBase64(value, false);
}

export function encodeUrlBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes, true);
}
