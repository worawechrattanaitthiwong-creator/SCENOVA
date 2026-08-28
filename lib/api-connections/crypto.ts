import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getMasterKey() {
  const raw = process.env.API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("API_KEY_ENCRYPTION_KEY_REQUIRED");

  if (/^[a-fA-F0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");

  const normalized = raw.startsWith("base64:") ? raw.slice(7) : raw;
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 32) return decoded;

  throw new Error("API_KEY_ENCRYPTION_KEY_MUST_BE_32_BYTES");
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
};

export function encryptApiSecret(secret: string): EncryptedSecret {
  const value = secret.trim();
  if (!value) throw new Error("API_KEY_REQUIRED");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptApiSecret(input: EncryptedSecret) {
  const payload = Buffer.from(input.ciphertext, "base64");
  const iv = Buffer.from(input.iv, "base64");
  if (iv.length !== IV_BYTES || payload.length <= AUTH_TAG_BYTES) throw new Error("INVALID_ENCRYPTED_API_KEY");

  const encrypted = payload.subarray(0, payload.length - AUTH_TAG_BYTES);
  const authTag = payload.subarray(payload.length - AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskApiKey(last4: string) {
  return `••••••••••••${last4}`;
}
