import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const OTP_DIGITS = 6;

function encryptionKey() {
  const source = process.env.TWO_FACTOR_ENCRYPTION_KEY || (process.env.NODE_ENV !== "production" ? process.env.SESSION_SECRET || "scenova-dev-2fa-key" : "");
  if (!source) throw new Error("TWO_FACTOR_ENCRYPTION_KEY_REQUIRED");
  return createHash("sha256").update(source).digest();
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

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTwoFactorSecret(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("INVALID_ENCRYPTED_SECRET");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString("hex").toUpperCase();
    return `SCN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

function recoveryPepper() {
  return process.env.SESSION_SECRET || "scenova-recovery-dev";
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(`${recoveryPepper()}:${code.trim().toUpperCase()}`).digest("hex");
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map(hashRecoveryCode);
}
