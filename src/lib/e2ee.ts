// End-to-end encryption helpers using WebCrypto.
// Scheme (hybrid):
//  - Identity key: RSA-OAEP 2048 + SHA-256 (long lived, per device/user)
//  - Message key: AES-GCM 256 (ephemeral, per message)
//  - ciphertext = AES-GCM(message JSON), key wrapped with each recipient RSA public key
// Server only ever sees ciphertext + wrapped keys — never plaintext.

export type MessageEnvelope = {
  ciphertext: string; // base64
  iv: string; // base64
  keys: Record<string, string>; // userId -> base64 wrapped AES key
};

export type DecryptedBody = {
  text: string;
  kind: "text" | "image" | "system";
  replyPreview?: string;
  sentAt: number;
};

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generateIdentityKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const pair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return pair as { publicKey: CryptoKey; privateKey: CryptoKey };
}

export async function exportPublicKeyB64(publicKey: CryptoKey): Promise<string> {
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  return bufToB64(spki);
}

export async function exportPrivateKeyJwk(privateKey: CryptoKey): Promise<JsonWebKey> {
  return (await window.crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;
}

export async function importPublicKeyB64(b64: string): Promise<CryptoKey> {
  const buf = b64ToBuf(b64);
  return window.crypto.subtle.importKey(
    "spki",
    buf as unknown as ArrayBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function encryptForRecipients(
  body: DecryptedBody,
  recipientPublicKeys: Map<string, CryptoKey>
): Promise<MessageEnvelope> {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(body));
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    aesKey,
    data as unknown as ArrayBuffer
  );
  const rawAes = await window.crypto.subtle.exportKey("raw", aesKey);
  const keys: Record<string, string> = {};
  for (const [userId, pub] of recipientPublicKeys) {
    const wrapped = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      pub,
      rawAes as ArrayBuffer
    );
    keys[userId] = bufToB64(wrapped);
  }
  return { ciphertext: bufToB64(ct), iv: bufToB64(iv), keys };
}

export async function decryptEnvelope(
  envelope: MessageEnvelope,
  myUserId: string,
  privateKey: CryptoKey
): Promise<DecryptedBody> {
  const wrappedB64 = envelope.keys[myUserId];
  if (!wrappedB64) throw new Error("No key for this device");
  const wrapped = b64ToBuf(wrappedB64);
  const rawAes = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrapped as unknown as ArrayBuffer
  );
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const iv = b64ToBuf(envelope.iv);
  const ct = b64ToBuf(envelope.ciphertext);
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    aesKey,
    ct as unknown as ArrayBuffer
  );
  return JSON.parse(new TextDecoder().decode(pt)) as DecryptedBody;
}

// Short fingerprint for "verify encryption" UI
export async function keyFingerprint(publicKeyB64: string): Promise<string> {
  const raw = b64ToBuf(publicKeyB64);
  const digest = await window.crypto.subtle.digest("SHA-256", raw as unknown as ArrayBuffer);
  const bytes = new Uint8Array(digest);
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    groups.push(
      String(bytes[i]).padStart(3, "0") + " " + String(bytes[i + 1]).padStart(3, "0")
    );
  }
  return groups.join("  ");
}

export const E2EE_STORE_PREFIX = "pingpro_e2ee_";

export function savePrivateKeyLocal(userId: string, jwk: JsonWebKey) {
  try {
    localStorage.setItem(E2EE_STORE_PREFIX + userId, JSON.stringify(jwk));
  } catch {
    // ignore
  }
}

export function loadPrivateKeyLocal(userId: string): JsonWebKey | null {
  try {
    const raw = localStorage.getItem(E2EE_STORE_PREFIX + userId);
    return raw ? (JSON.parse(raw) as JsonWebKey) : null;
  } catch {
    return null;
  }
}
