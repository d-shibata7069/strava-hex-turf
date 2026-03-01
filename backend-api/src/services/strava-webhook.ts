/**
 * Strava Webhook 受信・処理ロジック
 * - GET: 購読確認（hub.challenge をそのまま返す）
 * - POST: アクティビティイベント受信 → Polyline 取得 → H3 計算 → tiles Upsert
 */
import { createRequire } from "node:module";
import type { SupabaseClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const polyline = require("@mapbox/polyline") as { decode: (str: string, precision?: number) => [number, number][] };
import { getH3IndexesFromPoints } from "../utils/h3-utils.js";

/** Strava Webhook GET のクエリ（購読確認） */
export interface WebhookVerifyQuery {
  "hub.mode"?: string;
  "hub.challenge"?: string;
  "hub.verify_token"?: string;
}

/** 購読確認レスポンス: Strava は JSON で "hub.challenge" キーを期待 */
export function verifyWebhook(
  query: WebhookVerifyQuery
): { "hub.challenge": string } | null {
  const challenge = query["hub.challenge"];
  if (typeof challenge !== "string" || challenge === "") return null;
  return { "hub.challenge": challenge };
}

/** Strava API GET /activities/{id} の map 部分 */
export interface StravaActivityMap {
  summary_polyline?: string | null;
}

/** Strava API GET /activities/{id} のレスポンス（本処理で利用するフィールドのみ） */
export interface StravaActivityResponse {
  map?: StravaActivityMap | null;
}

/** 処理に必要な外部依存（テストで差し替え可能） */
export interface StravaWebhookDeps {
  supabase: SupabaseClient;
  fetchStravaActivity: (
    activityId: number,
    accessToken: string
  ) => Promise<StravaActivityResponse>;
  getH3IndexesFromPoints: (
    points: ReadonlyArray<[number, number]>
  ) => string[];
  /** DB に暗号化して保存されたトークンを復号する。未設定なら平文として扱う */
  decryptStravaToken?: (encrypted: string) => string | null;
}

/** users テーブルから取得する行（strava_id で検索） */
interface UserRow {
  id: string;
  strava_access_token: string | null;
}

/** group_members から取得する group_id */
interface GroupMemberRow {
  group_id: string;
}

/** tiles Upsert 用の行 */
interface TileRow {
  h3_index: string;
  group_id: string;
  owner_id: string;
  score: number;
  captured_at: string;
  last_updated_at: string;
}

const STRAVA_API_ACTIVITIES = "https://www.strava.com/api/v3/activities";
const TILE_SCORE_RESET = 100;

/**
 * アクティビティイベントを処理する（POST 用）
 * - 対象アスリートのアクセストークン取得 → Strava で polyline 取得 → H3 算出 → tiles Upsert
 */
export async function processActivityEvent(
  objectId: number,
  ownerId: number,
  deps: StravaWebhookDeps
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { supabase, fetchStravaActivity, getH3IndexesFromPoints: getH3 } = deps;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, strava_access_token")
    .eq("strava_id", ownerId)
    .maybeSingle();

  if (userError) {
    return { ok: false, reason: `users fetch error: ${userError.message}` };
  }
  const userRow = user as UserRow | null;
  if (!userRow?.id) {
    return { ok: false, reason: "user not found" };
  }
  let accessToken = userRow.strava_access_token;
  if (!accessToken || typeof accessToken !== "string") {
    return { ok: false, reason: "user has no strava_access_token" };
  }
  if (deps.decryptStravaToken) {
    const dec = deps.decryptStravaToken(accessToken);
    if (dec) accessToken = dec;
  }

  let activity = await fetchStravaActivity(objectId, accessToken);
  let summaryPolyline = activity?.map?.summary_polyline ?? null;
  if (!summaryPolyline || typeof summaryPolyline !== "string") {
    await new Promise((r) => setTimeout(r, 5000));
    activity = await fetchStravaActivity(objectId, accessToken);
    summaryPolyline = activity?.map?.summary_polyline ?? null;
  }
  if (!summaryPolyline || typeof summaryPolyline !== "string") {
    return { ok: false, reason: "activity has no map.summary_polyline" };
  }

  const decoded = polyline.decode(summaryPolyline) as [number, number][];
  const points: ReadonlyArray<[number, number]> = decoded;
  const h3Indexes = getH3(points);
  if (h3Indexes.length === 0) {
    return { ok: true }; // 通過タイルなしでも成功扱い
  }

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userRow.id);

  if (membersError) {
    return { ok: false, reason: `group_members fetch error: ${membersError.message}` };
  }
  const groupIds = (members as GroupMemberRow[] | null)?.map((r) => r.group_id) ?? [];
  if (groupIds.length === 0) {
    return { ok: true }; // 所属グループがなければスキップ
  }

  const now = new Date().toISOString();
  const rows: TileRow[] = [];
  for (const groupId of groupIds) {
    for (const h3Index of h3Indexes) {
      rows.push({
        h3_index: h3Index,
        group_id: groupId,
        owner_id: userRow.id,
        score: TILE_SCORE_RESET,
        captured_at: now,
        last_updated_at: now,
      });
    }
  }

  const { error: upsertError } = await supabase
    .from("tiles")
    .upsert(rows, { onConflict: "h3_index,group_id" });

  if (upsertError) {
    return { ok: false, reason: `tiles upsert error: ${upsertError.message}` };
  }

  const activityTilesRows = rows.map((r) => ({
    activity_id: objectId,
    user_id: userRow.id,
    h3_index: r.h3_index,
    group_id: r.group_id,
  }));
  const { error: activityTilesError } = await supabase
    .from("activity_tiles")
    .upsert(activityTilesRows, { onConflict: "activity_id,h3_index,group_id" });

  if (activityTilesError) {
    console.error("[processActivityEvent] activity_tiles upsert error:", activityTilesError);
    return { ok: false, reason: `activity_tiles upsert error: ${activityTilesError.message}` };
  }

  console.log("[processActivityEvent] tiles upserted", { rows: rows.length, groups: groupIds.length, h3Count: h3Indexes.length });
  return { ok: true };
}

/**
 * デフォルトの Strava API フェッチ実装（本番用）
 */
export function createDefaultStravaFetcher(): StravaWebhookDeps["fetchStravaActivity"] {
  return async (activityId: number, accessToken: string) => {
    const res = await fetch(`${STRAVA_API_ACTIVITIES}/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Strava API ${res.status}: ${text}`);
    }
    return res.json() as Promise<StravaActivityResponse>;
  };
}

/**
 * デフォルト依存で processActivityEvent を実行する際に使う deps を組み立てる
 */
export function createDefaultDeps(supabase: SupabaseClient): StravaWebhookDeps {
  return {
    supabase,
    fetchStravaActivity: createDefaultStravaFetcher(),
    getH3IndexesFromPoints,
  };
}

/**
 * アクティビティ削除イベントを処理する
 * - activity_tiles から当該 activity_id の行を取得
 * - 同一 user の別アクティビティが同じ (h3_index, group_id) を保持していなければ、tiles から当該タイルを削除
 * - 最後に activity_tiles から当該 activity_id の行を削除
 */
export async function processActivityDelete(
  objectId: number,
  ownerId: number,
  deps: { supabase: SupabaseClient }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { supabase } = deps;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("strava_id", ownerId)
    .maybeSingle();

  if (userError) {
    return { ok: false, reason: `users fetch error: ${userError.message}` };
  }
  const userRow = user as { id: string } | null;
  if (!userRow?.id) {
    return { ok: true }; // ユーザーがDBにいなければ何もしない
  }

  const { data: rows, error: fetchError } = await supabase
    .from("activity_tiles")
    .select("h3_index, group_id")
    .eq("activity_id", objectId)
    .eq("user_id", userRow.id);

  if (fetchError) {
    return { ok: false, reason: `activity_tiles fetch error: ${fetchError.message}` };
  }
  const toProcess = (rows ?? []) as { h3_index: string; group_id: string }[];
  if (toProcess.length === 0) {
    const { error: delErr } = await supabase
      .from("activity_tiles")
      .delete()
      .eq("activity_id", objectId);
    if (delErr) console.error("[processActivityDelete] activity_tiles delete error:", delErr);
    return { ok: true };
  }

  let deletedTiles = 0;
  for (const { h3_index, group_id } of toProcess) {
    const { count, error: countError } = await supabase
      .from("activity_tiles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userRow.id)
      .eq("h3_index", h3_index)
      .eq("group_id", group_id)
      .neq("activity_id", objectId);

    if (countError || (count ?? 0) > 0) {
      if (countError) {
        console.error("[processActivityDelete] count check error", { h3_index, group_id, error: countError.message });
      }
      continue; // 他アクティビティが同じタイルを保持しているかエラー → タイルは削除しない
    }

    const { error: tileDelError } = await supabase
      .from("tiles")
      .delete()
      .eq("h3_index", h3_index)
      .eq("group_id", group_id)
      .eq("owner_id", userRow.id);

    if (tileDelError) {
      console.error("[processActivityDelete] tiles delete error", { h3_index, group_id, error: tileDelError.message });
    } else {
      deletedTiles += 1;
    }
  }

  const { error: activityTilesDelError } = await supabase
    .from("activity_tiles")
    .delete()
    .eq("activity_id", objectId);

  if (activityTilesDelError) {
    return { ok: false, reason: `activity_tiles delete error: ${activityTilesDelError.message}` };
  }

  console.log("[processActivityDelete] done", { activity_id: objectId, tiles_removed: deletedTiles });
  return { ok: true };
}
