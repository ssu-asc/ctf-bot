/**
 * Discord Interaction 요청의 Ed25519 시그니처를 검증합니다.
 */

/** @param {Request} request */
/** @param {string} publicKey */
export async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.text();

  if (!signature || !timestamp) {
    return { isValid: false, body };
  }

  const encoder = new TextEncoder();
  const message = encoder.encode(timestamp + body);
  const signatureBytes = hexToUint8Array(signature);
  const publicKeyBytes = hexToUint8Array(publicKey);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "Ed25519", namedCurve: "Ed25519" },
    false,
    ["verify"]
  );

  const isValid = await crypto.subtle.verify(
    { name: "Ed25519" },
    cryptoKey,
    signatureBytes,
    message
  );

  return { isValid, body };
}

function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
