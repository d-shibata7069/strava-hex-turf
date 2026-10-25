import { describe, it, expect, vi } from "vitest";
import { latLngToCell } from "h3-js";
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
        // 削除は activity_id と user_id の両方で絞る（C-S6）ため、eq のチェーンに対応する
        const delChain = {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
        return { select, delete: () => delChain };
      }
      return {};
    });
    const result = await processActivityDelete(100, 200, {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
    });
    expect(result).toEqual({ ok: true });
  });

});

// ---------------------------------------------------------------------------
// 状態を持つインメモリ Supabase フェイク（冪等性・新旧・スコープ検証用）
// ---------------------------------------------------------------------------

type FakeRow = Record<string, unknown>;

class FakeQueryBuilder {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private filters: Array<[string, string, unknown]> = [];
  private payload: unknown = null;
  private conflict = "";
  private orderSpec: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private mode: "list" | "single" | "maybe" = "list";
  constructor(
    private store: Record<string, FakeRow[]>,
    private table: string
  ) {}
  select() {
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, "eq", v]);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push([c, "neq", v]);
    return this;
  }
  in(c: string, v: unknown[]) {
    this.filters.push([c, "in", v]);
    return this;
  }
  is(c: string, v: unknown) {
    this.filters.push([c, "is", v]);
    return this;
  }
  order(c: string, o: { ascending: boolean }) {
    this.orderSpec = { col: c, asc: o.ascending };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  insert(rows: FakeRow | FakeRow[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: FakeRow | FakeRow[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    this.conflict = opts?.onConflict ?? "";
    return this;
  }
  update(obj: FakeRow) {
    this.op = "update";
    this.payload = obj;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  private match(r: FakeRow) {
    return this.filters.every(([c, op, v]) => {
      const rv = r[c];
      if (op === "eq") return String(rv) === String(v);
      if (op === "neq") return String(rv) !== String(v);
      if (op === "in") return (v as unknown[]).map(String).includes(String(rv));
      if (op === "is") return (rv ?? null) === v;
      return true;
    });
  }
  private exec(): { data: unknown; error: unknown } {
    const rows = this.store[this.table] ?? (this.store[this.table] = []);
    if (this.op === "select") {
      let out = rows.filter((r) => this.match(r));
      if (this.orderSpec) {
        const { col, asc } = this.orderSpec;
        out = [...out].sort(
          (a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (asc ? 1 : -1)
        );
      }
      if (this.limitN != null) out = out.slice(0, this.limitN);
      if (this.mode === "single")
        return out.length === 1
          ? { data: out[0], error: null }
          : { data: null, error: { message: "single: not exactly one row" } };
      if (this.mode === "maybe")
        return out.length <= 1
          ? { data: out[0] ?? null, error: null }
          : { data: null, error: { message: "maybeSingle: multiple rows" } };
      return { data: out, error: null };
    }
    if (this.op === "insert" || this.op === "upsert") {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]) as FakeRow[];
      const result: FakeRow[] = [];
      for (const inc of incoming) {
        if (this.op === "upsert" && this.conflict) {
          const cols = this.conflict.split(",");
          const idx = rows.findIndex((r) =>
            cols.every((c) => String(r[c]) === String(inc[c]))
          );
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...inc };
            result.push(rows[idx]);
            continue;
          }
        }
        const nr = { ...inc };
        rows.push(nr);
        result.push(nr);
      }
      if (this.mode === "single") return { data: result[0], error: null };
      return { data: result, error: null };
    }
    if (this.op === "update") {
      const out: FakeRow[] = [];
      for (const r of rows)
        if (this.match(r)) {
          Object.assign(r, this.payload as FakeRow);
          out.push(r);
        }
      return { data: out, error: null };
    }
    this.store[this.table] = rows.filter((r) => !this.match(r));
    return { data: null, error: null };
  }
  then(resolve: (v: { data: unknown; error: unknown }) => void) {
    resolve(this.exec());
  }
}

function createFakeSupabase(store: Record<string, FakeRow[]>) {
  return {
    from: (t: string) => new FakeQueryBuilder(store, t),
  } as unknown as StravaWebhookDeps["supabase"];
}

/** 短いラン（約1km）の Polyline */
const SHORT_POLYLINE = "o~wxEkgatYwVcQ_XwQ";
/** 東京→大阪の Polyline（約396km） */
const TELEPORT_POLYLINE = "_wwxEoersYnj`EnjqX";

describe("processActivityEvent: athlete 照合と妥当性検証 (B-01/B-03)", () => {
  const mockDecrypt = (enc: string) => enc;

  function buildSimpleDeps(activity: Record<string, unknown>) {
    const mockTilesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "user-1", strava_access_token: "token", display_name: "Runner" },
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
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: mockLogsInsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue(activity),
      getH3IndexesFromPoints: vi.fn(() => ["cell-1"]),
      decryptStravaToken: mockDecrypt,
    };
    return { deps, mockTilesUpsert, mockLogsInsert };
  }

  it("athlete.id が owner_id と一致しない場合は拒否する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 9999 },
      sport_type: "Run",
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("athlete mismatch");
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });

  it("sport_type が Ride の場合は拒否する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Ride",
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("sport_type");
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });

  it("manual が true の場合は拒否する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      manual: true,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("manual");
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });

  it("trainer が true の場合は拒否する", async () => {
    const { deps } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      trainer: true,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("trainer");
  });

  it("average_speed が上限を超える場合は拒否する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      average_speed: 10,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("average_speed");
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });

  it("max_speed が上限を超える場合は拒否する", async () => {
    const { deps } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      max_speed: 20,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("max_speed");
  });

  it("distance / elapsed_time から算出した平均速度が上限を超える場合は拒否する", async () => {
    const { deps } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      distance: 1000,
      elapsed_time: 100,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("average_speed");
  });

  it("ポリライン経路長と distance の乖離が大きい場合はテレポートとして拒否する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: TELEPORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      distance: 5000,
      elapsed_time: 1800,
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("divergence");
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });

  it("妥当な Run アクティビティは通過する", async () => {
    const { deps, mockTilesUpsert } = buildSimpleDeps({
      map: { summary_polyline: SHORT_POLYLINE },
      athlete: { id: 200 },
      sport_type: "Run",
      manual: false,
      trainer: false,
      average_speed: 3,
      max_speed: 5,
      distance: 1000,
      elapsed_time: 330,
      start_date: "2026-10-20T09:00:00Z",
    });
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });
    expect(mockTilesUpsert).toHaveBeenCalledTimes(1);
  });

  it("401 の場合は refreshStravaToken を 1 回試行して再取得する", async () => {
    const mockTilesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "user-1",
                    strava_access_token: "old-token",
                    strava_refresh_token: "enc-refresh",
                    display_name: "Runner",
                  },
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
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });
    const fetchStravaActivity = vi
      .fn()
      .mockRejectedValueOnce(new Error("Strava API 401: Unauthorized"))
      .mockResolvedValueOnce({
        map: { summary_polyline: SHORT_POLYLINE },
        athlete: { id: 200 },
        sport_type: "Run",
        start_date: "2026-10-20T09:00:00Z",
      });
    const refreshStravaToken = vi.fn().mockResolvedValue("new-token");
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity,
      getH3IndexesFromPoints: vi.fn(() => ["cell-1"]),
      decryptStravaToken: mockDecrypt,
      refreshStravaToken,
    };
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });
    expect(refreshStravaToken).toHaveBeenCalledTimes(1);
    expect(fetchStravaActivity).toHaveBeenCalledTimes(2);
    expect(fetchStravaActivity.mock.calls[0][1]).toBe("old-token");
    expect(fetchStravaActivity.mock.calls[1][1]).toBe("new-token");
  });
});

describe("processActivityEvent: 冪等性・新旧チェック (B-07)", () => {
  const mockDecrypt = (enc: string) => enc;

  function buildStatefulSetup() {
    const store: Record<string, FakeRow[]> = {
      users: [
        { id: "user-a", strava_id: 1001, strava_access_token: "tok-a", display_name: "A" },
        { id: "user-b", strava_id: 1002, strava_access_token: "tok-b", display_name: "B" },
      ],
      group_members: [
        { group_id: "g1", user_id: "user-a" },
        { group_id: "g1", user_id: "user-b" },
      ],
      tiles: [],
      activity_tiles: [],
      activity_logs: [],
    };
    const activities: Record<number, Record<string, unknown>> = {
      1: {
        map: { summary_polyline: SHORT_POLYLINE },
        athlete: { id: 1001 },
        sport_type: "Run",
        start_date: "2026-10-10T09:00:00Z",
      },
      2: {
        map: { summary_polyline: SHORT_POLYLINE },
        athlete: { id: 1002 },
        sport_type: "Run",
        start_date: "2026-10-20T09:00:00Z",
      },
    };
    const deps: StravaWebhookDeps = {
      supabase: createFakeSupabase(store),
      fetchStravaActivity: vi.fn(async (id: number) => activities[id]),
      getH3IndexesFromPoints: vi.fn(() => ["cell-1"]),
      decryptStravaToken: mockDecrypt,
    };
    return { store, deps, activities };
  }

  it("古いイベントのリプレイで所有者・スコア・captured_at が巻き戻らない", async () => {
    const { store, deps } = buildStatefulSetup();
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    expect((await processActivityEvent(2, 1002, deps)).ok).toBe(true);
    const tile = store.tiles.find((t) => t.h3_index === "cell-1");
    expect(tile?.owner_id).toBe("user-b");
    // 減衰を再現
    tile!.score = 35;
    // A の古いイベントをリプレイ
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    const after = store.tiles.find((t) => t.h3_index === "cell-1");
    expect(after?.owner_id).toBe("user-b");
    expect(after?.score).toBe(35);
    expect(after?.captured_at).toBe("2026-10-20T09:00:00Z");
  });

  it("重複イベントで activity_logs が二重化しない", async () => {
    const { store, deps } = buildStatefulSetup();
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    expect(store.activity_logs).toHaveLength(1);
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    expect(store.activity_logs).toHaveLength(1);
  });

  it("同じ activity の再処理は冪等である（タイルが増えない）", async () => {
    const { store, deps } = buildStatefulSetup();
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    expect((await processActivityEvent(1, 1001, deps)).ok).toBe(true);
    expect(store.tiles).toHaveLength(1);
    expect(store.activity_tiles).toHaveLength(1);
  });

  it("update 再処理で今回含まれないセルは削除され古いタイルが残らない", async () => {
    const store: Record<string, FakeRow[]> = {
      users: [{ id: "user-a", strava_id: 1001, strava_access_token: "tok-a", display_name: "A" }],
      group_members: [{ group_id: "g1", user_id: "user-a" }],
      tiles: [],
      activity_tiles: [],
      activity_logs: [],
    };
    let cells = ["cell-1", "cell-2"];
    const deps: StravaWebhookDeps = {
      supabase: createFakeSupabase(store),
      fetchStravaActivity: vi.fn(async () => ({
        map: { summary_polyline: SHORT_POLYLINE },
        athlete: { id: 1001 },
        sport_type: "Run",
        start_date: "2026-10-10T09:00:00Z",
      })),
      getH3IndexesFromPoints: vi.fn(() => cells),
      decryptStravaToken: mockDecrypt,
    };
    expect((await processActivityEvent(10, 1001, deps)).ok).toBe(true);
    expect(store.tiles).toHaveLength(2);
    // 経路がトリミングされ cell-2 が外れた状態で再処理
    cells = ["cell-1"];
    expect((await processActivityEvent(10, 1001, deps)).ok).toBe(true);
    expect(store.tiles.map((t) => t.h3_index)).toEqual(["cell-1"]);
    expect(store.activity_tiles.map((t) => t.h3_index)).toEqual(["cell-1"]);
  });
});

describe("processActivityDelete: 所有者スコープと復元順序 (C-S6/B-08)", () => {
  it("他人の削除イベントで自分の activity_tiles が消えない", async () => {
    const store: Record<string, FakeRow[]> = {
      users: [
        { id: "user-a", strava_id: 1001 },
        { id: "user-b", strava_id: 1002 },
      ],
      group_members: [],
      tiles: [{ h3_index: "cell-1", group_id: "g1", owner_id: "user-b", score: 100, captured_at: "2026-10-20T09:00:00Z" }],
      activity_tiles: [
        { activity_id: 555, user_id: "user-b", h3_index: "cell-1", group_id: "g1", passed_through_at: "2026-10-20T09:00:00Z" },
      ],
      activity_logs: [],
    };
    // B の activity_id を A の owner_id で削除しようとする（偽装）
    const result = await processActivityDelete(555, 1001, { supabase: createFakeSupabase(store) });
    expect(result).toEqual({ ok: true });
    expect(store.activity_tiles).toHaveLength(1);
    expect(store.activity_tiles[0].user_id).toBe("user-b");
    expect(store.tiles).toHaveLength(1);
  });

  it("復元候補は passed_through_at 降順で選ぶ（activity_id 最大ではない）", async () => {
    const store: Record<string, FakeRow[]> = {
      users: [
        { id: "user-a", strava_id: 1001 },
        { id: "user-b", strava_id: 1002 },
        { id: "user-c", strava_id: 1003 },
      ],
      group_members: [],
      tiles: [{ h3_index: "cell-1", group_id: "g1", owner_id: "user-a", score: 100, captured_at: "2026-10-20T09:00:00Z" }],
      activity_tiles: [
        { activity_id: 10, user_id: "user-a", h3_index: "cell-1", group_id: "g1", passed_through_at: "2026-10-20T09:00:00Z" },
        // activity_id は大きいが通過時刻は古い候補
        { activity_id: 99, user_id: "user-b", h3_index: "cell-1", group_id: "g1", passed_through_at: "2026-10-01T09:00:00Z" },
        // activity_id は小さいが通過時刻は新しい候補（こちらが復元先になるべき）
        { activity_id: 20, user_id: "user-c", h3_index: "cell-1", group_id: "g1", passed_through_at: "2026-10-15T09:00:00Z" },
      ],
      activity_logs: [],
    };
    const result = await processActivityDelete(10, 1001, { supabase: createFakeSupabase(store) });
    expect(result).toEqual({ ok: true });
    const tile = store.tiles.find((t) => t.h3_index === "cell-1");
    expect(tile?.owner_id).toBe("user-c");
    expect(tile?.captured_at).toBe("2026-10-15T09:00:00Z");
    // 削除されたのは A のレコードだけ
    expect(store.activity_tiles.filter((r) => r.activity_id === 10)).toHaveLength(0);
    expect(store.activity_tiles).toHaveLength(2);
  });
});


describe("processActivityEvent: プライバシーゾーン除外 (A-6)", () => {
  const mockDecrypt = (enc: string) => enc;

  /** 東京駅周辺を囲む矩形ゾーン（GeoJSON、座標は [lng, lat] 順） */
  const TOKYO_ZONE = {
    type: "Polygon",
    coordinates: [
      [
        [139.75, 35.67],
        [139.78, 35.67],
        [139.78, 35.7],
        [139.75, 35.7],
        [139.75, 35.67],
      ],
    ],
  };
  /** ゾーン内（東京駅）のセルとゾーン外（大阪駅）のセル */
  const TOKYO_CELL = latLngToCell(35.6812, 139.7671, 7);
  const OSAKA_CELL = latLngToCell(34.7024, 135.4959, 7);

  function buildDeps(privacyZone: unknown) {
    const mockTilesUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "users")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "user-1",
                    strava_access_token: "token",
                    display_name: "Runner",
                    privacy_zone: privacyZone,
                  },
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
      if (table === "activity_tiles") return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "activity_logs") return { insert: mockLogsInsert };
      return {};
    });
    const deps: StravaWebhookDeps = {
      supabase: { from: mockFrom } as StravaWebhookDeps["supabase"],
      fetchStravaActivity: vi.fn().mockResolvedValue({
        map: { summary_polyline: SHORT_POLYLINE },
        athlete: { id: 200 },
        sport_type: "Run",
        start_date: "2026-10-20T09:00:00Z",
      }),
      getH3IndexesFromPoints: vi.fn(() => [TOKYO_CELL, OSAKA_CELL]),
      decryptStravaToken: mockDecrypt,
    };
    return { deps, mockTilesUpsert, mockLogsInsert };
  }

  it("プライバシーゾーン内のセルは領地化されず、ゾーン外のセルだけが残る", async () => {
    const { deps, mockTilesUpsert, mockLogsInsert } = buildDeps(TOKYO_ZONE);
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });
    expect(mockTilesUpsert).toHaveBeenCalledTimes(1);
    const rows = mockTilesUpsert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].h3_index).toBe(OSAKA_CELL);
    // ログメッセージのタイル数も除外後の件数になる
    const logRows = mockLogsInsert.mock.calls[0][0];
    expect(logRows[0].message).toBe("Runner が 1個の陣地を奪取・防衛しました！");
  });

  it("privacy_zone が null の場合は全セルが領地化される（従来通り）", async () => {
    const { deps, mockTilesUpsert } = buildDeps(null);
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });
    const rows = mockTilesUpsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { h3_index: string }) => r.h3_index).sort()).toEqual(
      [TOKYO_CELL, OSAKA_CELL].sort()
    );
  });

  it("全セルがゾーン内の場合は tiles へ Upsert せず成功扱いになる", async () => {
    const { deps, mockTilesUpsert } = buildDeps(TOKYO_ZONE);
    deps.getH3IndexesFromPoints = vi.fn(() => [TOKYO_CELL]);
    const result = await processActivityEvent(100, 200, deps);
    expect(result).toEqual({ ok: true });
    expect(mockTilesUpsert).not.toHaveBeenCalled();
  });
});
