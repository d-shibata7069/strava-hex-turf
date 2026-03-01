import { describe, it, expect, vi } from "vitest";
import {
  verifyWebhook,
  processActivityEvent,
  processActivityDelete,
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
  /** テスト用: DB の「暗号化値」をそのまま Bearer トークンとして使うモック */
  const mockDecrypt = (enc: string) => enc;

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
      decryptStravaToken: mockDecrypt,
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
      decryptStravaToken: mockDecrypt,
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "user has no strava_access_token" });
  });

  it("トークン復号に失敗した場合は ok: false", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-1", strava_access_token: "encrypted-value", display_name: "User" },
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
      decryptStravaToken: () => null,
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "strava_access_token decryption failed" });
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
      decryptStravaToken: mockDecrypt,
    };
    const result = await processActivityEvent(12345, 999, deps);
    expect(result).toEqual({ ok: false, reason: "activity has no map.summary_polyline" });
  }, 10000);

  it("Polyline をデコードして H3 を計算し、tiles に Upsert を呼び、activity_logs に Insert する", async () => {
    const mockGetH3 = vi.fn((_points: ReadonlyArray<[number, number]>) => ["87283472bffffff", "87283472cffffff"]);
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-uuid-1", strava_access_token: "strava-token", display_name: "テストユーザー" },
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
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: mockLogsInsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
      }),
      getH3IndexesFromPoints: mockGetH3,
      decryptStravaToken: mockDecrypt,
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

    expect(mockLogsInsert).toHaveBeenCalledTimes(1);
    const [logRows] = mockLogsInsert.mock.calls[0];
    expect(logRows).toHaveLength(1);
    expect(logRows[0]).toMatchObject({
      group_id: "group-uuid-1",
      user_id: "user-uuid-1",
      action: "capture",
      message: "テストユーザー が 2個の陣地を奪取・防衛しました！",
    });
    expect(logRows[0].h3_index).toBeNull();
  });

  it("複数グループの場合は全グループ分のタイルを Upsert し、グループごとに activity_logs を 1 件ずつ Insert する", async () => {
    const mockGetH3 = vi.fn(() => ["h3-one"]);
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "u1", strava_access_token: "t", display_name: "ランナーA" },
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
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: mockLogsInsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
      }),
      getH3IndexesFromPoints: mockGetH3,
      decryptStravaToken: mockDecrypt,
    };
    const result = await processActivityEvent(1, 2, deps);
    expect(result).toEqual({ ok: true });
    const rows = mockUpsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    const groupIds = rows.map((r: { group_id: string }) => r.group_id).sort();
    expect(groupIds).toEqual(["g1", "g2"]);

    const logRows = mockLogsInsert.mock.calls[0][0];
    expect(logRows).toHaveLength(2);
    expect(logRows.map((r: { group_id: string }) => r.group_id).sort()).toEqual(["g1", "g2"]);
    expect(logRows[0].message).toBe("ランナーA が 1個の陣地を奪取・防衛しました！");
  });

  it("display_name が空の場合は「ランナー」として activity_logs に記録する", async () => {
    const mockGetH3 = vi.fn(() => ["h3-one"]);
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "u1", strava_access_token: "t", display_name: "" },
                  error: null,
                }),
            }),
          }),
        };
      if (table === "group_members")
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ group_id: "g1" }], error: null }),
          }),
        };
      if (table === "tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: mockLogsInsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
      }),
      getH3IndexesFromPoints: mockGetH3,
      decryptStravaToken: mockDecrypt,
    };
    const result = await processActivityEvent(1, 2, deps);
    expect(result).toEqual({ ok: true });
    expect(mockLogsInsert.mock.calls[0][0][0].message).toBe("ランナー が 1個の陣地を奪取・防衛しました！");
  });

  it("アクティビティに start_date がある場合は last_updated_at / captured_at にその日時を使う", async () => {
    const activityStartDate = "2024-06-15T08:30:00Z";
    const mockGetH3 = vi.fn(() => ["h3-one"]);
    const mockTilesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockActivityTilesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "u1", strava_access_token: "t", display_name: "A" },
                  error: null,
                }),
            }),
          }),
        };
      if (table === "group_members")
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ group_id: "g1" }], error: null }),
          }),
        };
      if (table === "tiles") return { upsert: mockTilesUpsert };
      if (table === "activity_tiles") return { upsert: mockActivityTilesUpsert };
      if (table === "activity_logs") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: DUMMY_POLYLINE },
        start_date: activityStartDate,
      }),
      getH3IndexesFromPoints: mockGetH3,
      decryptStravaToken: mockDecrypt,
    };
    const result = await processActivityEvent(1, 2, deps);
    expect(result).toEqual({ ok: true });

    const tileRows = mockTilesUpsert.mock.calls[0][0];
    expect(tileRows[0].last_updated_at).toBe(activityStartDate);
    expect(tileRows[0].captured_at).toBe(activityStartDate);

    const activityTilesRows = mockActivityTilesUpsert.mock.calls[0][0];
    expect(activityTilesRows[0].passed_through_at).toBe(activityStartDate);
  });
});

describe("processActivityDelete", () => {
  it("ユーザーがDBにいない場合は ok: true（何もしない）", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        };
      return {};
    });
    const result = await processActivityDelete(100, 999, {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
    });
    expect(result).toEqual({ ok: true });
  });

  it("当該 activity_id の activity_tiles が無い場合は ok: true", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-1" },
                  error: null,
                }),
            }),
          }),
        };
      if (table === "activity_tiles") {
        const select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        });
        const del = vi.fn().mockResolvedValue({ error: null });
        return { select, delete: () => ({ eq: del }) };
      }
      return {};
    });
    const result = await processActivityDelete(100, 200, {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
    });
    expect(result).toEqual({ ok: true });
  });

});
