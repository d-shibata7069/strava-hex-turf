/**
 * SECURITY REGRESSION tests (Phase 2 re-verification).
 *
 * 元の redteam.test.ts は「攻撃が成功すること」を期待する攻撃証明ハーネス
 * だった。本ファイルはその攻撃シナリオ群（レッドチーム報告 C 班 S4〜S6 等）を
 * 「攻撃が防御されること」を検証する回帰テストに書き換えたもの。
 * 実物の processActivityEvent / processActivityDelete を、インメモリの
 * Supabase フェイク + モック Strava ペイロードで駆動する（実 API は使わない）。
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import {
  processActivityEvent,
  processActivityDelete,
  type StravaWebhookDeps,
  type StravaActivityResponse,
} from "./services/strava-webhook.js";
import { getH3IndexesFromPoints } from "./utils/h3-utils.js";

const require = createRequire(import.meta.url);
const polylineLib = require("@mapbox/polyline") as {
  encode: (pts: [number, number][], precision?: number) => string;
};

const GROUP = "group-1";
const USER_A = "user-a";
const USER_B = "user-b";
const STRAVA_A = 900001;
const STRAVA_B = 900002;

// ---------------------------------------------------------------------------
// 状態を持つインメモリ Supabase フェイク
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class QB {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private filters: Array<[string, string, unknown]> = [];
  private payload: unknown = null;
  private conflict = "";
  private orderSpec: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private mode: "list" | "single" | "maybe" = "list";
  constructor(
    private store: Record<string, Row[]>,
    private table: string
  ) {}
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
  neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
  in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
  is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
  order(c: string, o: { ascending: boolean }) { this.orderSpec = { col: c, asc: o.ascending }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = rows; this.conflict = opts?.onConflict ?? ""; return this; }
  update(obj: Row) { this.op = "update"; this.payload = obj; return this; }
  delete() { this.op = "delete"; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  private match(r: Row) {
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
        out = [...out].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (asc ? 1 : -1));
      }
      if (this.limitN != null) out = out.slice(0, this.limitN);
      if (this.mode === "single")
        return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "single: not exactly one row" } };
      if (this.mode === "maybe")
        return out.length <= 1 ? { data: out[0] ?? null, error: null } : { data: null, error: { message: "maybeSingle: multiple rows" } };
      return { data: out, error: null };
    }
    if (this.op === "insert" || this.op === "upsert") {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const result: Row[] = [];
      for (const inc of incoming) {
        if (this.op === "upsert" && this.conflict) {
          const cols = this.conflict.split(",");
          const idx = rows.findIndex((r) => cols.every((c) => String(r[c]) === String(inc[c])));
          if (idx >= 0) { rows[idx] = { ...rows[idx], ...inc }; result.push(rows[idx]); continue; }
        }
        const nr = { ...inc };
        rows.push(nr);
        result.push(nr);
      }
      if (this.mode === "single") return { data: result[0], error: null };
      return { data: result, error: null };
    }
    if (this.op === "update") {
      const out: Row[] = [];
      for (const r of rows) if (this.match(r)) { Object.assign(r, this.payload as Row); out.push(r); }
      return { data: out, error: null };
    }
    this.store[this.table] = rows.filter((r) => !this.match(r));
    return { data: null, error: null };
  }
  then(resolve: (v: { data: unknown; error: unknown }) => void) { resolve(this.exec()); }
}

// ---------------------------------------------------------------------------
// モック Strava アクティビティ
// ---------------------------------------------------------------------------

const PTS = {
  runA: [[35.68, 139.7], [35.702, 139.7], [35.724, 139.7]] as [number, number][],
  runB: [[35.702, 139.7], [35.702, 139.727]] as [number, number][],
  teleport: [[35.6938, 139.7034], [34.6937, 135.5023], [35.1815, 136.9066], [35.702, 139.727]] as [number, number][],
};

/**
 * アクティビティ定義。
 * - 9001: A の正当な Run（2026-10-10、経路長 約4.9km / distance 4900m で整合）
 * - 9002: B の正当な Run（2026-10-20、経路長 約2.4km / distance 2400m で整合）
 * - 9003: A のテレポート偽装（経路長 500km 超に対し distance 5000m → 乖離大）
 * - 9004: athlete が B なのに owner は A という不一致イベント
 */
const ACTIVITIES: Record<number, StravaActivityResponse> = {
  9001: {
    map: { summary_polyline: polylineLib.encode(PTS.runA) },
    start_date: "2026-10-10T09:00:00Z",
    athlete: { id: STRAVA_A },
    sport_type: "Run",
    manual: false,
    trainer: false,
    average_speed: 2.7,
    max_speed: 5,
    distance: 4900,
    elapsed_time: 1800,
  },
  9002: {
    map: { summary_polyline: polylineLib.encode(PTS.runB) },
    start_date: "2026-10-20T09:00:00Z",
    athlete: { id: STRAVA_B },
    sport_type: "Run",
    manual: false,
    trainer: false,
    average_speed: 2.7,
    max_speed: 5,
    distance: 2400,
    elapsed_time: 900,
  },
  9003: {
    map: { summary_polyline: polylineLib.encode(PTS.teleport) },
    start_date: "2026-10-21T09:00:00Z",
    athlete: { id: STRAVA_A },
    sport_type: "Run",
    manual: false,
    trainer: false,
    average_speed: 2.7,
    max_speed: 5,
    distance: 5000,
    elapsed_time: 1800,
  },
  9004: {
    map: { summary_polyline: polylineLib.encode(PTS.runA) },
    start_date: "2026-10-22T09:00:00Z",
    athlete: { id: STRAVA_B }, // owner (A) と不一致
    sport_type: "Run",
    manual: false,
    trainer: false,
    average_speed: 2.7,
    max_speed: 5,
    distance: 4900,
    elapsed_time: 1800,
  },
};

function createHarness() {
  const store: Record<string, Row[]> = {
    users: [
      { id: USER_A, strava_id: STRAVA_A, display_name: "Runner A", strava_access_token: "tok-a" },
      { id: USER_B, strava_id: STRAVA_B, display_name: "Runner B", strava_access_token: "tok-b" },
    ],
    group_members: [
      { group_id: GROUP, user_id: USER_A },
      { group_id: GROUP, user_id: USER_B },
    ],
    tiles: [],
    activity_tiles: [],
    activity_logs: [],
  };
  const fakeSupabase = { from: (t: string) => new QB(store, t) } as unknown as StravaWebhookDeps["supabase"];
  const deps: StravaWebhookDeps = {
    supabase: fakeSupabase,
    fetchStravaActivity: async (id: number) => {
      const a = ACTIVITIES[id];
      if (!a) throw new Error("Strava API 404: Record Not Found");
      return a;
    },
    getH3IndexesFromPoints,
    decryptStravaToken: (enc: string) => enc,
  };
  const tileOf = (cell: string) => store.tiles.find((t) => t.h3_index === cell && t.group_id === GROUP);
  const cellOf = (p: [number, number]) => getH3IndexesFromPoints([p])[0];
  return { store, deps, fakeSupabase, tileOf, cellOf };
}

describe("SECURITY REGRESSION: 攻撃が防御されること", () => {
  it("正常系コントロール: 正当な Run アクティビティは今まで通りタイルを獲得できる", async () => {
    const { store, deps, tileOf, cellOf } = createHarness();
    const r = await processActivityEvent(9001, STRAVA_A, deps);
    expect(r.ok).toBe(true);
    expect(store.tiles).toHaveLength(3);
    expect(store.tiles.every((t) => t.owner_id === USER_A)).toBe(true);
    expect(tileOf(cellOf(PTS.runA[0]))?.score).toBe(100);
    expect(store.activity_tiles.filter((t) => Number(t.activity_id) === 9001)).toHaveLength(3);
    expect(store.activity_logs.filter((l) => l.user_id === USER_A)).toHaveLength(1);
  });

  it("S4 リプレイ防御: A の古いイベントのリプレイで所有者・スコア・captured_at が巻き戻らず、ログが二重化しない", async () => {
    const { store, deps, tileOf, cellOf } = createHarness();
    // A が正当に獲得 → B が後から同じタイルを奪取
    expect((await processActivityEvent(9001, STRAVA_A, deps)).ok).toBe(true);
    expect((await processActivityEvent(9002, STRAVA_B, deps)).ok).toBe(true);
    const shared = cellOf(PTS.runA[1]);
    expect(tileOf(shared)?.owner_id).toBe(USER_B);
    // B 保有中に減衰した状態を再現
    tileOf(shared)!.score = 35;
    const tilesBefore = store.tiles.length;
    const logsBefore = store.activity_logs.filter((l) => l.user_id === USER_A).length;
    const activityTilesBefore = store.activity_tiles.length;

    // 攻撃: A の古いイベント（2026-10-10）をそのままリプレイ
    const r = await processActivityEvent(9001, STRAVA_A, deps);
    expect(r.ok).toBe(true); // 冪等な再処理として受理はされるが、状態は巻き戻らない

    const after = tileOf(shared)!;
    expect(after.owner_id).toBe(USER_B); // 巻き戻し奪取されない
    expect(after.score).toBe(35); // 減衰がリセットされない
    expect(after.captured_at).toBe("2026-10-20T09:00:00Z"); // B の日時のまま
    expect(store.tiles).toHaveLength(tilesBefore);
    expect(store.activity_tiles).toHaveLength(activityTilesBefore);
    expect(store.activity_logs.filter((l) => l.user_id === USER_A)).toHaveLength(logsBefore); // ログ二重化なし
  });

  it("S5 テレポート防御: 経路長と distance が大きく乖離するポリラインは拒否され、他人のタイルを奪えない", async () => {
    const { store, deps, tileOf, cellOf } = createHarness();
    // B が正当にホームタイルを保有
    expect((await processActivityEvent(9002, STRAVA_B, deps)).ok).toBe(true);
    const bUnique = cellOf(PTS.runB[1]);
    expect(tileOf(bUnique)?.owner_id).toBe(USER_B);
    const tilesBefore = store.tiles.length;

    // 攻撃: 東京→大阪→名古屋と跳ぶポリライン + B のタイル上の点（distance は 5km と申告）
    const r = await processActivityEvent(9003, STRAVA_A, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("divergence");

    const osaka = cellOf(PTS.teleport[1]);
    const nagoya = cellOf(PTS.teleport[2]);
    expect(tileOf(osaka)).toBeUndefined(); // 大阪のタイルは生まれない
    expect(tileOf(nagoya)).toBeUndefined(); // 名古屋のタイルも生まれない
    expect(tileOf(bUnique)?.owner_id).toBe(USER_B); // B のタイルは奪われない
    expect(store.tiles).toHaveLength(tilesBefore);
    expect(store.tiles.every((t) => t.owner_id !== USER_A)).toBe(true);
  });

  it("S6 偽造削除防御: 所有者を偽った削除で他人の activity_tiles が消えない", async () => {
    const { store, deps, fakeSupabase } = createHarness();
    expect((await processActivityEvent(9002, STRAVA_B, deps)).ok).toBe(true);
    const before = store.activity_tiles.filter((t) => Number(t.activity_id) === 9002);
    expect(before.length).toBeGreaterThan(0);
    const tilesBefore = store.tiles.length;

    // 攻撃: B の activity_id を A の owner_id で削除
    const r = await processActivityDelete(9002, STRAVA_A, { supabase: fakeSupabase });
    expect(r.ok).toBe(true); // 対象なしの冪等な no-op として完了する

    const after = store.activity_tiles.filter((t) => Number(t.activity_id) === 9002);
    expect(after).toHaveLength(before.length); // B の裏付けレコードは消えない
    expect(after.every((t) => t.user_id === USER_B)).toBe(true);
    expect(store.tiles).toHaveLength(tilesBefore); // B のタイルも残る
  });

  it("S6 正常系コントロール: 本人による正当な削除は activity_tiles を消去できる（防御のやり過ぎでないこと）", async () => {
    const { store, deps, fakeSupabase } = createHarness();
    expect((await processActivityEvent(9002, STRAVA_B, deps)).ok).toBe(true);
    expect(store.activity_tiles.filter((t) => Number(t.activity_id) === 9002).length).toBeGreaterThan(0);
    const r = await processActivityDelete(9002, STRAVA_B, { supabase: fakeSupabase });
    expect(r.ok).toBe(true);
    expect(store.activity_tiles.filter((t) => Number(t.activity_id) === 9002)).toHaveLength(0);
  });

  it("athlete 不一致防御: イベントの owner とアクティビティの athlete が異なる場合は拒否される", async () => {
    const { store, deps } = createHarness();
    // activity 9004 の athlete は B だが、イベント owner は A
    const r = await processActivityEvent(9004, STRAVA_A, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("athlete mismatch");
    expect(store.tiles).toHaveLength(0);
    expect(store.activity_tiles).toHaveLength(0);
    expect(store.activity_logs).toHaveLength(0);
  });

  it("防御が既存にあるケース: ポリラインなしアクティビティはタイルを獲得できない", async () => {
    const { store, deps } = createHarness();
    const depsNoMap: StravaWebhookDeps = {
      ...deps,
      fetchStravaActivity: async () => ({ map: {} }),
    };
    const r = await processActivityEvent(9999, STRAVA_A, depsNoMap);
    expect(r.ok).toBe(false);
    expect(store.tiles).toHaveLength(0);
  }, 20000);
});
