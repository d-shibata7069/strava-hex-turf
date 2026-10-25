/**
 * 内部 API 認証（backend-api のエンドポイント呼び出し元検証）
 * - A-3 / B-02: backend の全 POST エンドポイントは、クライアント（Next.js）からの
 *   内部呼び出しであることを共有キーで検証する。
 * - ヘッダ x-internal-api-key を環境変数 INTERNAL_API_KEY と定数時間で照合する。
 * - 環境変数が未設定の場合は常に不一致とする（fail closed）。
 */
import { timingSafeEqual } from "node:crypto";

/** 内部認証に使うヘッダ名 */
export const INTERNAL_API_KEY_HEADER = "x-internal-api-key";

/** 初期バックフィル用の後方互換ヘッダ名 */
export const INTERNAL_BACKFILL_API_KEY_HEADER = "x-internal-backfill-key";

/**
 * 2つの文字列を定数時間で比較する。
 * 長さが異なる場合は timingSafeEqual が例外を投げるため、先に長さをチェックする。
 */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isValidKeyAgainstEnv(
  provided: string | string[] | undefined | null,
  envValue: string | undefined
): boolean {
  // 環境変数未設定・空文字なら常に不一致（fail closed）
  if (!envValue) return false;
  if (typeof provided !== "string" || provided === "") return false;
  return safeEqualString(provided, envValue);
}

/**
 * x-internal-api-key の値を環境変数 INTERNAL_API_KEY と照合する。
 * 環境変数が未設定なら常に false。
 */
export function isValidInternalApiKey(
  provided: string | string[] | undefined | null
): boolean {
  return isValidKeyAgainstEnv(provided, process.env.INTERNAL_API_KEY);
}

/**
 * x-internal-backfill-key の値を環境変数 INTERNAL_BACKFILL_API_KEY と照合する。
 * 環境変数が未設定なら常に false。
 * /users/initial-backfill の後方互換用（新しい x-internal-api-key でも通す運用と併用）。
 */
export function isValidBackfillApiKey(
  provided: string | string[] | undefined | null
): boolean {
  return isValidKeyAgainstEnv(provided, process.env.INTERNAL_BACKFILL_API_KEY);
}
