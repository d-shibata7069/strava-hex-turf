/**
 * Strava トークンの復号（client で暗号化した値を DB から読み取り時に復号）
 * client の lib/strava-token-crypto と同じ AES-256-GCM 形式。
 */
import { createDecipheriv } from "node:crypto";

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
 * 暗号化済みトークンを復号する。キー未設定または復号失敗時は null。
 * 平文での DB 保存は禁止のため、呼び出し側で null のときに平文として扱ってはならない。
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
