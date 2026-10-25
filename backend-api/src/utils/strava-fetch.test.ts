import { describe, it, expect, vi } from "vitest";
import { fetchWithBackoff } from "./strava-fetch.js";

function fakeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

describe("fetchWithBackoff", () => {
  it("429 の後に成功した場合はリトライして成功レスポンスを返す", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(429))
      .mockResolvedValueOnce(fakeResponse(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const res = await fetchWithBackoff("https://www.strava.com/api/v3/activities/1", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
      baseDelayMs: 100,
    });
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("5xx の場合もリトライする", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const res = await fetchWithBackoff("https://example.com", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
    });
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("Retry-After ヘッダを尊重して待機する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(fakeResponse(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const res = await fetchWithBackoff("https://example.com", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
      baseDelayMs: 100,
    });
    expect(res.status).toBe(200);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("404 などリトライ対象外のステータスはリトライしない", async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(404));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const res = await fetchWithBackoff("https://example.com", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
    });
    expect(res.status).toBe(404);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("リトライ上限に達した場合は最後のレスポンスを返す", async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(429));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const res = await fetchWithBackoff("https://example.com", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
      maxRetries: 3,
      baseDelayMs: 10,
    });
    expect(res.status).toBe(429);
    // 初回 + 3 回リトライ
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("待機時間は maxDelayMs で頭打ちになる", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(429, { "retry-after": "120" }))
      .mockResolvedValueOnce(fakeResponse(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await fetchWithBackoff("https://example.com", {}, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
      maxDelayMs: 5000,
    });
    expect(sleep).toHaveBeenCalledWith(5000);
  });
});
