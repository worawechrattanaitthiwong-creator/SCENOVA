import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const OTP_DIGITS = 6;
const AES_GCM_TAG_BYTES = 16;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function keySource() {
  const source = process.env.TWO_FACTOR_ENCRYPTION_KEY || (process.env.NODE_ENV !== "production" ? process.env.SESSION_SECRET || "scenova-dev-2fa-key" : "");
  if (!source) throw new Error("TWO_FACTOR_ENCRYPTION_KEY_REQUIRED");
  return source;
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(keySource()));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function generateTotpSecret(bytes = 20) {
  const input = randomBytes(bytes);
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    output += BASE32[Number.parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(secret: string) {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("INVALID_TOTP_SECRET");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secret: string, timestampMs: number) {
  const counter = Math.floor(timestampMs / 1000 / STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** OTP_DIGITS).padStart(OTP_DIGITS, "0");
}

export function verifyTotp(secret: string, codeInput: string, window = 1) {
  const code = codeInput.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = totpAt(secret, Date.now() + drift * STEP_SECONDS * 1000);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function buildOtpAuthUri(input: { secret: string; email: string; issuer?: string }) {
  const issuer = input.issuer || "SCENOVA";
  const label = `${issuer}:${input.email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(input.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Use Web Crypto for AES-GCM so the same implementation runs natively in
// Cloudflare Workers and Node 22. The serialized format remains compatible
// with the previous Node createCipheriv implementation: iv.tag.ciphertext.
export async function encryptTwoFactorSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: AES_GCM_TAG_BYTES * 8 },
      key,
      textEncoder.encode(secret),
    ),
  );

  if (sealed.length <= AES_GCM_TAG_BYTES) throw new Error("INVALID_ENCRYPTED_SECRET");
  const encrypted = sealed.slice(0, sealed.length - AES_GCM_TAG_BYTES);
  const tag = sealed.slice(sealed.length - AES_GCM_TAG_BYTES);
  return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export async function decryptTwoFactorSecret(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("INVALID_ENCRYPTED_SECRET");

  const iv = fromBase64Url(ivPart);
  const tag = fromBase64Url(tagPart);
  const encrypted = fromBase64Url(encryptedPart);
  if (iv.length !== 12 || tag.length !== AES_GCM_TAG_BYTES) throw new Error("INVALID_ENCRYPTED_SECRET");

  const sealed = new Uint8Array(encrypted.length + tag.length);
  sealed.set(encrypted, 0);
  sealed.set(tag, encrypted.length);
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: AES_GCM_TAG_BYTES * 8 },
    key,
    sealed,
  );
  return textDecoder.decode(decrypted);
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString("hex").toUpperCase();
    return `SCN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(`${keySource()}:recovery:${code.trim().toUpperCase()}`).digest("hex");
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map(hashRecoveryCode);
}
