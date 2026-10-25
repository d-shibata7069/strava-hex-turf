/**
 * Strava API 向け fetch（429 / 5xx へのバックオフ付き）
 * - B-10: Strava のレート制限（429）や一時的な 5xx で即座に失敗せず、
 *   Retry-After を尊重しながら指数バックオフで再試行する。
 * - テストでは sleep と fetchFn を差し替えて待たずに検証できるようにする。
 */

/** fetchWithBackoff のオプション */
export interface FetchWithBackoffOptions {
  /** リトライ回数の上限（初回試行は含まない）。デフォルト 3 回 */
  maxRetries?: number;
  /** 指数バックオフの初回待機時間（ミリ秒）。デフォルト 500ms */
  baseDelayMs?: number;
  /** 待機時間の上限（ミリ秒）。Retry-After がこれを超える場合もこの値で頭打ちにする。デフォルト 30,000ms */
  maxDelayMs?: number;
  /** 待機実装（テストで差し替え可能） */
  sleep?: (ms: number) => Promise<void>;
  /** fetch 実装（テストで差し替え可能） */
  fetchFn?: typeof fetch;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry-After ヘッダ（秒数または HTTP 日付）をミリ秒に変換する。解釈できなければ null */
function parseRetryAfterMs(headerValue: string | null, now: number): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (trimmed === "") return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now);
  }
  return null;
}

/** リトライ対象かどうか（429 または 5xx） */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * 429 / 5xx の場合に最大 maxRetries 回までリトライする fetch。
 * - Retry-After ヘッダがあればそれを優先し、なければ指数バックオフを使う。
 * - リトライ上限に達した場合は最後のレスポンスをそのまま返す（throw しない）。
 *   呼び出し側は従来どおり res.ok を判定すること。
 */
export async function fetchWithBackoff(
  url: string | URL,
  init?: RequestInit,
  options?: FetchWithBackoffOptions
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleep = options?.sleep ?? defaultSleep;
  const fetchFn = options?.fetchFn ?? fetch;

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchFn(url, init);
    lastResponse = res;
    if (!isRetryableStatus(res.status) || attempt === maxRetries) {
      return res;
    }
    const retryAfterMs = parseRetryAfterMs(
      typeof res.headers?.get === "function" ? res.headers.get("retry-after") : null,
      Date.now()
    );
    const exponentialMs = baseDelayMs * 2 ** attempt;
    const delayMs = Math.min(maxDelayMs, retryAfterMs ?? exponentialMs);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
  // 到達しないはずだが、型のために最後のレスポンスを返す
  return lastResponse as Response;
}
