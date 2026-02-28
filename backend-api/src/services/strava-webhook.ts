/**
 * Strava Webhook 受信・処理ロジック
 * - GET: 購読確認（hub.challenge を返す）
 * - POST: アクティビティ作成/更新イベント → Polyline取得 → H3計算 → tiles Upsert
 */
import polyline from "@mapbox/polyline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getH3IndexesFromPoints } from "../utils/h3-utils.js";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/** Webhook 検証用 GET クエリ（hub.challenge を含む） */
export interface WebhookVerifyQuery {
  "hub.mode"?: string;
  "hub.challenge"?: string;
  "hub.verify_token"?: string;
}

/** Strava GET /activities/{id} の map 部分 */
export interface StravaActivityMap {
  id?: string;
  summary_polyline?: string | null;
  polyline?: string | null;
}

/** Strava GET /activities/{id} レスポンス（必要なフィールドのみ） */
export interface StravaActivityResponse {
  id?: number;
  map?: StravaActivityMap | null;
}

/** 外部から注入する Strava API 取得関数（テスト用） */
export type FetchStravaActivityFn = (
  activityId: number,
  accessToken: string
) => Promise<StravaActivityResponse>;

/**
 * Strava の Webhook 購読確認リクエストに対して hub.challenge をそのまま返す
 * @param query - GET のクエリ（hub.mode, hub.challenge, hub.verify_token）
 * @returns レスポンスボディ（{ "hub.challenge": "<value>" }）、検証失敗時は null
 */
export function verifyWebhook(query: WebhookVerifyQuery): { "hub.challenge": string } | null {
  const challenge = query["hub.challenge"];
  if (typeof challenge !== "string" || challenge.length === 0) {
    return null;
  }
  return { "hub.challenge": challenge };
}

/**
 * アクティビティID と アスリートID から、走行ルートを取得し tiles を更新する
 * - users から strava_id = ownerId のレコードでアクセストークン取得
 * - Strava API で map.summary_polyline 取得
 * - Polyline デコード → H3 インデックス取得 → tiles Upsert（owner_id, score=100, captured_at=now）
 */
export async function processActivityEvent(
  objectId: number,
  ownerId: number,
  supabase: SupabaseClient,
  fetchStravaActivity: FetchStravaActivityFn = defaultFetchStravaActivity
): Promise<{ success: boolean; error?: string }> {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, strava_access_token")
    .eq("strava_id", ownerId)
    .single();

  if (userError || !userRow) {
    return { success: false, error: "user_not_found" };
  }

  const accessToken = userRow.strava_access_token as string | null | undefined;
  if (!accessToken) {
    return { success: false, error: "missing_access_token" };
  }

  const activity = await fetchStravaActivity(objectId, accessToken);
  const encoded = activity?.map?.summary_polyline ?? activity?.map?.polyline ?? null;
  if (!encoded || typeof encoded !== "string") {
    return { success: false, error: "no_polyline" };
  }

  const points = polyline.decode(encoded) as [number, number][];
  const h3Indexes = getH3IndexesFromPoints(points);
  if (h3Indexes.length === 0) {
    return { success: true }; // ポイントなしはスキップ
  }

  const userId = userRow.id as string;

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  const groupIds = (memberships ?? []).map((r) => r.group_id as string);
  if (groupIds.length === 0) {
    return { success: true }; // 所属グループなしはスキップ
  }

  const now = new Date().toISOString();
  const rows = groupIds.flatMap((group_id) =>
    h3Indexes.map((h3_index) => ({
      h3_index,
      group_id,
      owner_id: userId,
      score: 100,
      captured_at: now,
    }))
  );

  const { error: upsertError } = await supabase.from("tiles").upsert(rows, {
    onConflict: "h3_index,group_id",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  return { success: true };
}

async function defaultFetchStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivityResponse> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status}`);
  }
  return res.json() as Promise<StravaActivityResponse>;
}
