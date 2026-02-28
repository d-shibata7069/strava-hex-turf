import { describe, it, expect, vi } from "vitest";
import {
  verifyWebhook,
  processActivityEvent,
  type StravaWebhookDeps,
  type WebhookVerifyQuery,
} from "./strava-webhook.js";

describe("verifyWebhook", () => {
  it("hub.challenge が文字列ならそのまま返す", () => {
    const query: WebhookVerifyQuery = {
      "hub.mode": "subscribe",
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
      "hub.verify_token": "my-verify-token",
    };
    expect(verifyWebhook(query)).toEqual({
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
    });
  });

  it("hub.challenge が無い場合は null", () => {
    expect(verifyWebhook({})).toBeNull();
    expect(verifyWebhook({ "hub.mode": "subscribe" })).toBeNull();
  });

  it("hub.challenge が空文字の場合は null", () => {
    expect(verifyWebhook({ "hub.challenge": "" })).toBeNull();
  });
});

describe("processActivityEvent", () => {
  /** ダミー Polyline（Mapbox の例: デコードすると [lat, lng] の配列になる） */
  const DUMMY_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  it("ユーザー未登録の場合は ok: false", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn(),
      getH3IndexesFromPoints: vi.fn(),
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "user not found" });
  });

  it("アクセストークンが無い場合は ok: false", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-1", strava_access_token: null },
                  error: null,
                }),
            }),
          }),
        };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn(),
      getH3IndexesFromPoints: vi.fn(),
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "user has no strava_access_token" });
  });

  it("summary_polyline が無い場合は ok: false", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-1", strava_access_token: "token" },
                  error: null,
                }),
            }),
          }),
        };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({ map: {} }),
      getH3IndexesFromPoints: vi.fn(),
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "activity has no map.summary_polyline" });
  });

  it("Polyline をデコードして H3 を計算し、tiles に Upsert を呼ぶ", async () => {
    const mockGetH3 = vi.fn((_points: ReadonlyArray<[number, number]>) => ["87283472bffffff", "87283472cffffff"]);
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-uuid-1", strava_access_token: "strava-token" },
                  error: null,
                }),
            }),
          }),
        };
      if (table === "group_members")
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ group_id: "group-uuid-1" }],
                error: null,
              }),
          }),
        };
      if (table === "tiles") return { upsert: mockUpsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
      }),
      getH3IndexesFromPoints: mockGetH3,
    };
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });

    expect(mockGetH3).toHaveBeenCalledTimes(1);
    const points = mockGetH3.mock.calls[0][0] as [number, number][];
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toHaveLength(2);
    expect(typeof points[0][0]).toBe("number");
    expect(typeof points[0][1]).toBe("number");

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = mockUpsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "h3_index,group_id" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      h3_index: "87283472bffffff",
      group_id: "group-uuid-1",
      owner_id: "user-uuid-1",
      score: 100,
    });
    expect(rows[0].last_updated_at).toBeDefined();
    expect(rows[0].captured_at).toBeDefined();
    expect(rows[1]).toMatchObject({
      h3_index: "87283472cffffff",
      group_id: "group-uuid-1",
      owner_id: "user-uuid-1",
      score: 100,
    });
  });

  it("複数グループの場合は全グループ分のタイルを Upsert する", async () => {
    const mockGetH3 = vi.fn(() => ["h3-one"]);
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "u1", strava_access_token: "t" },
                  error: null,
                }),
            }),
          }),
        };
      if (table === "group_members")
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ group_id: "g1" }, { group_id: "g2" }],
                error: null,
              }),
          }),
        };
      if (table === "tiles") return { upsert: mockUpsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
      }),
      getH3IndexesFromPoints: mockGetH3,
    };
    const result = await processActivityEvent(1, 2, deps);
    expect(result).toEqual({ ok: true });
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    const groupIds = rows.map((r: { group_id: string }) => r.group_id).sort();
    expect(groupIds).toEqual(["g1", "g2"]);
  });
});
