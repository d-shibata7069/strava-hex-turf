/**
 * Strava アクセス／リフレッシュトークンの AES-256-GCM 暗号化（DB 保存用）
 * client では保存時に encrypt、backend-api では読み取り時に decrypt を使用する。
 */
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer | null {
  const raw = process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") return null;
  const key = Buffer.from(raw, "base64");
  return key.length === KEY_LEN ? key : null;
}

/**
 * トークンを暗号化し、base64(iv + ciphertext + authTag) を返す。
 * STRAVA_TOKEN_ENCRYPTION_KEY が未設定の場合は null を返す。
 * 平文での DB 保存は禁止のため、null の場合はトークンを保存してはならない。
 */
export function encryptStravaToken(plaintext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

/**
 * 暗号化済みトークンを復号する（client では通常不要。backend で利用）。
 * 復号に失敗した場合やキー未設定の場合は null を返す。
 * 平文が DB に保存されている場合は復号できないため null となる。平文保存は禁止。
 */
export function decryptStravaToken(encrypted: string): string | null {
  const key = getKey();
  if (!key) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(encrypted, "base64");
  } catch {
    return null;
  }
  if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - AUTH_TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  try {
    return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}
