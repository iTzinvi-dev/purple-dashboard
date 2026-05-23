// Native Web Crypto wrappers — zero external deps.
// AES-GCM-256 for confidentiality + integrity; PBKDF2-SHA256 for passphrase derivation.

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023+ recommendation for SHA-256
const SALT_BYTES = 16;
const IV_BYTES = 12;

// TS 6 narrows Uint8Array generics; cast at WebCrypto boundaries to keep call sites clean.
type AnyBuf = Uint8Array | ArrayBuffer;
const asBuf = (b: AnyBuf): BufferSource => b as unknown as BufferSource;
const u8 = (b: ArrayBuffer): Uint8Array => new Uint8Array(b);

export const randomBytes = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
};

export const generateMasterKey = async (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

export const exportRawKey = async (key: CryptoKey): Promise<Uint8Array> =>
  u8(await crypto.subtle.exportKey("raw", key));

export const importRawKey = async (raw: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", asBuf(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

export const deriveKeyFromPassphrase = async (
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    asBuf(new TextEncoder().encode(passphrase)),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuf(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export interface EncryptedBlob {
  iv: Uint8Array;
  ct: Uint8Array;
}

export const encryptBytes = async (key: CryptoKey, plain: Uint8Array): Promise<EncryptedBlob> => {
  const iv = randomBytes(IV_BYTES);
  const ct = u8(await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuf(iv) }, key, asBuf(plain)));
  return { iv, ct };
};

export const decryptBytes = async (key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> =>
  u8(await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBuf(blob.iv) }, key, asBuf(blob.ct)));

export const encryptJson = async (key: CryptoKey, value: unknown): Promise<EncryptedBlob> => {
  const plain = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(key, plain);
};

export const decryptJson = async <T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> => {
  const plain = await decryptBytes(key, blob);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
};

// Base64 helpers — for export blobs and JSON-safe transport.
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

export const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export { PBKDF2_ITERATIONS, SALT_BYTES, IV_BYTES };
