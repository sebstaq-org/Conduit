const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_PATTERN =
  /^(?:[+/0-9A-Za-z]{4})*(?:[+/0-9A-Za-z]{2}==|[+/0-9A-Za-z]{3}=)?$/;

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) {
    throw new Error("pairing offer fragment must be valid bytes");
  }
  return value;
}

function sextet(character: string): number {
  const value = BASE64_ALPHABET.indexOf(character);
  if (value === -1) {
    throw new Error("pairing offer contains invalid base64");
  }
  return value;
}

function normalizedBase64(
  encoded: string,
  label: string,
  urlSafe: boolean,
): string {
  let normalized = encoded;
  if (urlSafe) {
    normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  }
  if (normalized.length % 4 === 1) {
    throw new Error(`${label} must be valid base64`);
  }
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  if (!BASE64_PATTERN.test(padded)) {
    throw new Error(`${label} must be valid base64`);
  }
  return padded;
}

function optionalSextet(character: string): number {
  if (character === "=") {
    return 0;
  }
  return sextet(character);
}

function decodePaddedBase64Chunk(chunk: string, bytes: number[]): void {
  const first = sextet(chunk.charAt(0));
  const second = sextet(chunk.charAt(1));
  const third = optionalSextet(chunk.charAt(2));
  const fourth = optionalSextet(chunk.charAt(3));
  bytes.push(first * 4 + Math.floor(second / 16));
  if (chunk.charAt(2) !== "=") {
    bytes.push((second % 16) * 16 + Math.floor(third / 4));
  }
  if (chunk.charAt(3) !== "=") {
    bytes.push((third % 4) * 64 + fourth);
  }
}

function decodeBase64Bytes(
  encoded: string,
  label: string,
  urlSafe: boolean,
): Uint8Array {
  const padded = normalizedBase64(encoded, label, urlSafe);
  const bytes: number[] = [];
  for (let index = 0; index < padded.length; index += 4) {
    decodePaddedBase64Chunk(padded.slice(index, index + 4), bytes);
  }
  return Uint8Array.from(bytes);
}

function decodeAscii(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const value = byteAt(bytes, index);
    if (value > 127) {
      throw new Error("pairing offer fragment must be ASCII JSON");
    }
    result += String.fromCodePoint(value);
  }
  return result;
}

function decodeBase64UrlJson(encoded: string): string {
  return decodeAscii(
    decodeBase64Bytes(encoded, "pairing offer fragment", true),
  );
}

export { decodeBase64Bytes, decodeBase64UrlJson };
