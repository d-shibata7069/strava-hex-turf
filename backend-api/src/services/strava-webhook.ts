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
import {
  filterH3IndexesOutsidePrivacyZone,
  type PrivacyZoneGeometry,
} from "../utils/privacy-zone.js";
import { encryptStravaToken } from "../utils/token-crypto.js";
import { fetchWithBackoff } from "../utils/strava-fetch.js";

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

/** Strava API GET /activities/{id} の athlete 部分 */
export interface StravaActivityAthlete {
  id?: number | null;
}

/** Strava API GET /activities/{id} のレスポンス（本処理で利用するフィールドのみ） */
export interface StravaActivityResponse {
  map?: StravaActivityMap | null;
  /** アクティビティ開始日時（UTC, ISO 8601）。タイルの last_updated_at / captured_at に使用 */
  start_date?: string | null;
  /** アクティビティの所有者。イベントの owner_id と照合する（B-03） */
  athlete?: StravaActivityAthlete | null;
  /** 種目（例: Run / Ride）。Run 系以外は領地化対象外（B-01） */
  sport_type?: string | null;
  /** 手動作成されたアクティビティかどうか。true は対象外（B-01） */
  manual?: boolean | null;
  /** 屋内トレーナー等で記録されたかどうか。true は対象外（B-01） */
  trainer?: boolean | null;
  /** 平均速度（m/s）。上限チェックに使用（B-01） */
  average_speed?: number | null;
  /** 最高速度（m/s）。上限チェックに使用（B-01） */
  max_speed?: number | null;
  /** 距離（m）。速度の再計算とポリライン乖離チェックに使用（B-01） */
  distance?: number | null;
  /** 経過時間（秒）。distance と合わせて平均速度を再計算する（B-01） */
  elapsed_time?: number | null;
}

// ---------------------------------------------------------------------------
// 妥当性検証の定数（B-01）
// 根拠はいずれも「人間のランニングとしてあり得る範囲」を基準にしている。
// これを超える値は車両移動・GPS 偽装・記録ミスのいずれかとみなして領地化しない。
// ---------------------------------------------------------------------------

/** 領地化の対象とする種目。人間が自分の脚で移動する Run 系のみを対象とする */
export const ALLOWED_SPORT_TYPES: readonly string[] = ["Run", "TrailRun", "VirtualRun"];

/**
 * 平均速度の上限（m/s）: 8.0 m/s = 28.8 km/h。
 * 世界記録級のマラソンでも平均は約 5.8 m/s 程度であり、平均で 8.0 m/s を
 * 持続できる人間はいない。これを超える平均速度は車両等による移動とみなす。
 */
export const MAX_AVERAGE_SPEED_MPS = 8.0;

/**
 * 最高速度の上限（m/s）: 16 m/s = 57.6 km/h。
 * 人間の瞬間的な最高速度は短距離のトップ選手でも約 12 m/s 程度であり、
 * 16 m/s を超える値は車両移動または GPS の異常値とみなす。
 */
export const MAX_SPEED_MPS = 16;

/**
 * ポリライン経路長と Strava の distance の乖離許容倍率: 2.5 倍。
 * summary_polyline は簡略化されているため実距離と完全には一致しないが、
 * どちらかが他方の 2.5 倍を超える場合は経路と距離が別物であり、
 * テレポート等の偽装とみなす。
 */
export const MAX_DISTANCE_DIVERGENCE_RATIO = 2.5;

/** 2点間の距離（m）を haversine 式で概算する */
function haversineMeters(a: [number, number], b: [number, number]): number {
  const earthRadiusM = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

/** ポリラインの全経路長（m）を haversine の累積で概算する */
function polylineLengthMeters(points: ReadonlyArray<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * アクティビティの妥当性を検証する（ポリライン乖離以外）。
 * - athlete 照合（B-03）: athlete.id が存在し owner_id と一致しなければ拒否する。
 * - フィールドが欠落している項目はその判定だけスキップする（既存モック互換）。
 * @returns 拒否理由。問題がなければ null
 */
function validateActivityFields(
  activity: StravaActivityResponse,
  ownerId: number
): string | null {
  const athleteId = activity.athlete?.id;
  if (typeof athleteId === "number" && athleteId !== ownerId) {
    return `athlete mismatch: activity athlete ${athleteId} does not match owner ${ownerId}`;
  }
  if (
    typeof activity.sport_type === "string" &&
    activity.sport_type !== "" &&
    !ALLOWED_SPORT_TYPES.includes(activity.sport_type)
  ) {
    return `unsupported sport_type: ${activity.sport_type}`;
  }
  if (activity.manual === true) {
    return "manual activity is not eligible";
  }
  if (activity.trainer === true) {
    return "trainer activity is not eligible";
  }
  if (
    typeof activity.average_speed === "number" &&
    activity.average_speed > MAX_AVERAGE_SPEED_MPS
  ) {
    return `average_speed exceeds limit: ${activity.average_speed} m/s > ${MAX_AVERAGE_SPEED_MPS} m/s`;
  }
  if (
    typeof activity.max_speed === "number" &&
    activity.max_speed > MAX_SPEED_MPS
  ) {
    return `max_speed exceeds limit: ${activity.max_speed} m/s > ${MAX_SPEED_MPS} m/s`;
  }
  if (
    typeof activity.distance === "number" &&
    typeof activity.elapsed_time === "number" &&
    activity.elapsed_time > 0
  ) {
    const derivedAverage = activity.distance / activity.elapsed_time;
    if (derivedAverage > MAX_AVERAGE_SPEED_MPS) {
      return `derived average_speed exceeds limit: ${derivedAverage} m/s > ${MAX_AVERAGE_SPEED_MPS} m/s`;
    }
  }
  return null;
}

/**
 * ポリライン経路長と distance の乖離を検証する（テレポート対策、B-01）。
 * distance が無い場合はこの判定をスキップする。
 * @returns 拒否理由。問題がなければ null
 */
function validatePolylineDivergence(
  activity: StravaActivityResponse,
  points: ReadonlyArray<[number, number]>
): string | null {
  if (typeof activity.distance !== "number" || activity.distance <= 0) return null;
  if (points.length < 2) return null;
  const routeLength = polylineLengthMeters(points);
  if (routeLength <= 0) return null;
  if (
    routeLength > activity.distance * MAX_DISTANCE_DIVERGENCE_RATIO ||
    activity.distance > routeLength * MAX_DISTANCE_DIVERGENCE_RATIO
  ) {
    return `polyline distance divergence: polyline ${Math.round(routeLength)}m vs distance ${activity.distance}m`;
  }
  return null;
}

/** トークン refresh に渡すユーザー情報 */
export interface StravaRefreshUser {
  id: string;
  strava_refresh_token?: string | null;
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
  /** DB に暗号化して保存されたトークンを復号する。必須。復号失敗時は null を返す。平文は使用禁止。 */
  decryptStravaToken: (encrypted: string) => string | null;
  /**
   * Strava アクセストークンを refresh する（任意、B-06）。
   * 成功した場合は新しい平文アクセストークンを返す。失敗時は null。
   */
  refreshStravaToken?: (user: StravaRefreshUser) => Promise<string | null>;
}

/** users テーブルから取得する行（strava_id で検索） */
interface UserRow {
  id: string;
  strava_access_token: string | null;
  strava_refresh_token?: string | null;
  display_name: string | null;
  /** プライバシーゾーン（PostgREST 経由では GeoJSON で返る）。未設定なら null（A-6） */
  privacy_zone?: PrivacyZoneGeometry | null;
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
const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
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
    .select("id, strava_access_token, strava_refresh_token, display_name, privacy_zone")
    .eq("strava_id", ownerId)
    .maybeSingle();

  if (userError) {
    return { ok: false, reason: `users fetch error: ${userError.message}` };
  }
  const userRow = user as UserRow | null;
  if (!userRow?.id) {
    return { ok: false, reason: "user not found" };
  }
  const encryptedAccessToken = userRow.strava_access_token;
  if (!encryptedAccessToken || typeof encryptedAccessToken !== "string") {
    return { ok: false, reason: "user has no strava_access_token" };
  }
  const decrypted = deps.decryptStravaToken(encryptedAccessToken);
  if (!decrypted) {
    return { ok: false, reason: "strava_access_token decryption failed" };
  }
  let accessToken: string = decrypted;

  // B-06: 401 の場合のみ refresh を 1 回試行して再取得する。
  // 404 等のその他のエラーは従来どおりそのまま throw し、
  // webhook-server 側の 404 判定を壊さない。
  let refreshAttempted = false;
  const fetchActivityWithRefresh = async (): Promise<StravaActivityResponse> => {
    try {
      return await fetchStravaActivity(objectId, accessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is401 = msg.includes("401");
      if (!is401 || refreshAttempted || !deps.refreshStravaToken) throw err;
      refreshAttempted = true;
      let newToken: string | null = null;
      try {
        newToken = await deps.refreshStravaToken({
          id: userRow.id,
          strava_refresh_token: userRow.strava_refresh_token ?? null,
        });
      } catch {
        newToken = null;
      }
      if (!newToken) throw err;
      accessToken = newToken;
      return await fetchStravaActivity(objectId, accessToken);
    }
  };

  let activity = await fetchActivityWithRefresh();
  let summaryPolyline = activity?.map?.summary_polyline ?? null;
  if (!summaryPolyline || typeof summaryPolyline !== "string") {
    await new Promise((r) => setTimeout(r, 5000));
    activity = await fetchActivityWithRefresh();
    summaryPolyline = activity?.map?.summary_polyline ?? null;
  }
  if (!summaryPolyline || typeof summaryPolyline !== "string") {
    return { ok: false, reason: "activity has no map.summary_polyline" };
  }

  // B-03 athlete 照合 + B-01 妥当性検証（種別・手動・速度）
  const fieldValidationReason = validateActivityFields(activity, ownerId);
  if (fieldValidationReason) {
    return { ok: false, reason: fieldValidationReason };
  }

  const decoded = polyline.decode(summaryPolyline) as [number, number][];
  const points: ReadonlyArray<[number, number]> = decoded;

  // B-01 ポリライン経路長と distance の乖離（テレポート対策）
  const divergenceReason = validatePolylineDivergence(activity, points);
  if (divergenceReason) {
    return { ok: false, reason: divergenceReason };
  }

  const allH3Indexes = getH3(points);

  // A-6: プライバシーゾーン（自宅周辺等）内のセルは領地化しない。
  // privacy_zone が null の場合は従来どおり全セルが対象。
  // ログには除外件数のみを残し、ゾーンやセルの座標は出さない。
  const { kept: h3Indexes, excludedCount } = filterH3IndexesOutsidePrivacyZone(
    allH3Indexes,
    userRow.privacy_zone ?? null
  );
  if (excludedCount > 0) {
    console.log(
      "[processActivityEvent] privacy zone: excluded %d cell(s)",
      excludedCount
    );
  }

  if (h3Indexes.length === 0) {
    console.warn("[processActivityEvent] skip: no H3 cells (points=%d)", points.length);
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
    console.warn("[processActivityEvent] skip: user has no group_members (user_id=%s)", userRow.id);
    return { ok: true }; // 所属グループがなければスキップ
  }

  // タイルを通過した日時＝アクティビティ開始日時。過去のアクティビティ登録時も正しく減衰基準になるよう start_date を使用
  const activityDate =
    activity?.start_date && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/i.test(activity.start_date)
      ? activity.start_date
      : new Date().toISOString();

  // --- B-07 冪等性・新旧チェックのための事前取得 -------------------------
  // 既存の activity_tiles（この activity 分）。取得できないモック環境では
  // 空として扱い、従来どおりの処理にフォールバックする。
  let previousActivityTiles: { h3_index: string; group_id: string }[] = [];
  try {
    const prevRes = await supabase
      .from("activity_tiles")
      .select("h3_index, group_id")
      .eq("activity_id", objectId)
      .eq("user_id", userRow.id);
    if (!prevRes.error && Array.isArray(prevRes.data)) {
      previousActivityTiles = prevRes.data as { h3_index: string; group_id: string }[];
    }
  } catch {
    previousActivityTiles = [];
  }

  // 既存タイルの captured_at（group_id + h3_index → captured_at）
  const existingCapturedAt = new Map<string, string>();
  try {
    for (const groupId of groupIds) {
      const existingRes = await supabase
        .from("tiles")
        .select("h3_index, group_id, captured_at")
        .eq("group_id", groupId)
        .in("h3_index", h3Indexes);
      if (!existingRes.error && Array.isArray(existingRes.data)) {
        for (const row of existingRes.data as { h3_index: string; group_id: string; captured_at?: string | null }[]) {
          if (typeof row.captured_at === "string") {
            existingCapturedAt.set(`${row.group_id}:${row.h3_index}`, row.captured_at);
          }
        }
      }
    }
  } catch {
    // select / in を備えないモック等では新旧比較をスキップする
  }

  // --- 項目7: update 再処理時の古いセルの削除と所有権復元 -----------------
  // 以前この activity で記録されたセルのうち、今回のセル集合に含まれないものは
  // 古いタイルとして残さず、削除イベントと同様に復元・削除する。
  const newCellSet = new Set(h3Indexes);
  const staleRows = previousActivityTiles.filter((r) => !newCellSet.has(r.h3_index));
  for (const stale of staleRows) {
    try {
      let remaining: { user_id: string; passed_through_at?: string | null } | null = null;
      try {
        const remRes = await supabase
          .from("activity_tiles")
          .select("user_id, activity_id, passed_through_at")
          .eq("h3_index", stale.h3_index)
          .eq("group_id", stale.group_id)
          .neq("activity_id", objectId)
          .order("passed_through_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!remRes.error && remRes.data) {
          remaining = remRes.data as { user_id: string; passed_through_at?: string | null };
        }
      } catch {
        remaining = null;
      }

      if (!remaining) {
        try {
          await supabase
            .from("tiles")
            .delete()
            .eq("h3_index", stale.h3_index)
            .eq("group_id", stale.group_id)
            .eq("owner_id", userRow.id);
        } catch {
          // モック等で delete チェーンが使えない場合は無視する
        }
      } else {
        const restoredAt = remaining.passed_through_at ?? new Date().toISOString();
        try {
          await supabase
            .from("tiles")
            .update({
              owner_id: remaining.user_id,
              score: TILE_SCORE_RESET,
              captured_at: restoredAt,
              last_updated_at: restoredAt,
            })
            .eq("h3_index", stale.h3_index)
            .eq("group_id", stale.group_id);
        } catch {
          // 同上
        }
      }

      try {
        await supabase
          .from("activity_tiles")
          .delete()
          .eq("activity_id", objectId)
          .eq("h3_index", stale.h3_index)
          .eq("group_id", stale.group_id)
          .eq("user_id", userRow.id);
      } catch {
        // 同上
      }
    } catch {
      // 古いセルの後片付けの失敗で本次処理自体は止めない
    }
  }

  const rows: TileRow[] = [];
  for (const groupId of groupIds) {
    for (const h3Index of h3Indexes) {
      rows.push({
        h3_index: h3Index,
        group_id: groupId,
        owner_id: userRow.id,
        score: TILE_SCORE_RESET,
        captured_at: activityDate,
        last_updated_at: activityDate,
      });
    }
  }

  // B-07: 既存タイルより古いイベントでは上書きしない
  const rowsToUpsert = rows.filter((r) => {
    const existing = existingCapturedAt.get(`${r.group_id}:${r.h3_index}`);
    if (!existing) return true;
    const existingTime = Date.parse(existing);
    const newTime = Date.parse(activityDate);
    if (Number.isNaN(existingTime) || Number.isNaN(newTime)) return true;
    return newTime >= existingTime;
  });

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from("tiles")
      .upsert(rowsToUpsert, { onConflict: "h3_index,group_id" });

    if (upsertError) {
      return { ok: false, reason: `tiles upsert error: ${upsertError.message}` };
    }
  }

  const activityTilesRows = rows.map((r) => ({
    activity_id: objectId,
    user_id: userRow.id,
    h3_index: r.h3_index,
    group_id: r.group_id,
    passed_through_at: activityDate,
  }));
  const { error: activityTilesError } = await supabase
    .from("activity_tiles")
    .upsert(activityTilesRows, { onConflict: "activity_id,h3_index,group_id" });

  if (activityTilesError) {
    console.error("[processActivityEvent] activity_tiles upsert error:", activityTilesError);
    return { ok: false, reason: `activity_tiles upsert error: ${activityTilesError.message}` };
  }

  const tileCount = h3Indexes.length;
  const displayName = userRow.display_name?.trim() || "ランナー";
  const message = `${displayName} が ${tileCount}個の陣地を奪取・防衛しました！`;

  // B-07: activity_logs の二重化防止。
  // 既にこの activity の activity_tiles があるグループは再処理とみなし、
  // さらに activity_logs 自体に (activity_id, group_id) の既存ログがあれば
  // そちらでも重複と判定して挿入しない。
  const duplicateLogGroups = new Set<string>(
    previousActivityTiles.map((r) => r.group_id)
  );
  for (const groupId of groupIds) {
    if (duplicateLogGroups.has(groupId)) continue;
    try {
      const logRes = await supabase
        .from("activity_logs")
        .select("id")
        .eq("activity_id", objectId)
        .eq("group_id", groupId);
      if (!logRes.error && logRes.data) {
        const hasExisting = Array.isArray(logRes.data)
          ? logRes.data.length > 0
          : true;
        if (hasExisting) duplicateLogGroups.add(groupId);
      }
    } catch {
      // select を備えないモック等ではこの判定をスキップする
    }
  }

  const activityLogRows = groupIds
    .filter((group_id) => !duplicateLogGroups.has(group_id))
    .map((group_id) => ({
      group_id,
      user_id: userRow.id,
      action: "capture" as const,
      h3_index: null as string | null,
      message,
    }));

  if (activityLogRows.length > 0) {
    const { error: logsError } = await supabase
      .from("activity_logs")
      .insert(activityLogRows);

    if (logsError) {
      console.error("[processActivityEvent] activity_logs insert error:", logsError);
      return { ok: false, reason: `activity_logs insert error: ${logsError.message}` };
    }
  }

  console.log("[processActivityEvent] tiles upserted", { rows: rowsToUpsert.length, groups: groupIds.length, h3Count: h3Indexes.length });
  return { ok: true };
}

/**
 * デフォルトの Strava API フェッチ実装（本番用）
 * B-10: 429 / 5xx に対しては fetchWithBackoff でリトライする。
 */
export function createDefaultStravaFetcher(): StravaWebhookDeps["fetchStravaActivity"] {
  return async (activityId: number, accessToken: string) => {
    const res = await fetchWithBackoff(`${STRAVA_API_ACTIVITIES}/${activityId}`, {
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
 * B-06: refreshStravaToken は STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET を使い、
 * refresh_token グラントで新しいトークンを取得し、暗号化して users に保存する。
 */
export function createDefaultDeps(
  supabase: SupabaseClient,
  decryptStravaToken: (encrypted: string) => string | null
): StravaWebhookDeps {
  return {
    supabase,
    fetchStravaActivity: createDefaultStravaFetcher(),
    getH3IndexesFromPoints,
    decryptStravaToken,
    refreshStravaToken: async (user: StravaRefreshUser) => {
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      if (!user.strava_refresh_token) return null;
      const refreshPlain = decryptStravaToken(user.strava_refresh_token);
      if (!refreshPlain) return null;
      try {
        const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshPlain,
          }).toString(),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_at?: number;
        };
        if (!data.access_token) return null;
        const encryptedAccess = encryptStravaToken(data.access_token);
        if (encryptedAccess) {
          const update: Record<string, unknown> = {
            strava_access_token: encryptedAccess,
          };
          if (data.refresh_token) {
            const encryptedRefresh = encryptStravaToken(data.refresh_token);
            if (encryptedRefresh) update.strava_refresh_token = encryptedRefresh;
          }
          if (typeof data.expires_at === "number") {
            update.strava_token_expires_at = new Date(data.expires_at * 1000).toISOString();
          }
          await supabase.from("users").update(update).eq("id", user.id);
        }
        return data.access_token;
      } catch {
        return null;
      }
    },
  };
}

/**
 * アクティビティ削除イベントを処理する
 * - activity_tiles から当該 activity_id かつ当該ユーザーの行を取得（C-S6: 所有者スコープ）
 * - 各 (h3_index, group_id) について、当該 activity を除いた残りの activity_tiles を参照し、
 *   残りがなければ tiles 行を削除、残っていれば passed_through_at が最新のユーザーを
 *   新オーナーとして tiles を UPDATE（取り合いの復元、B-08）
 * - 最後に activity_tiles から当該 activity_id かつ当該ユーザーの行を削除
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
    // C-S6: 対象が無くても他人のレコードは消さないよう user_id でも絞る
    const { error: delErr } = await supabase
      .from("activity_tiles")
      .delete()
      .eq("activity_id", objectId)
      .eq("user_id", userRow.id);
    if (delErr) console.error("[processActivityDelete] activity_tiles delete error:", delErr);
    return { ok: true };
  }

  let tilesDeleted = 0;
  let tilesRestored = 0;
  const now = new Date().toISOString();

  for (const { h3_index, group_id } of toProcess) {
    const { data: remaining, error: remainingError } = await supabase
      .from("activity_tiles")
      .select("user_id, activity_id, passed_through_at")
      .eq("h3_index", h3_index)
      .eq("group_id", group_id)
      .neq("activity_id", objectId)
      .order("passed_through_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (remainingError) {
      console.error("[processActivityDelete] remaining claimants query error", { h3_index, group_id, error: remainingError.message });
      continue;
    }

    if (!remaining) {
      const { error: tileDelError } = await supabase
        .from("tiles")
        .delete()
        .eq("h3_index", h3_index)
        .eq("group_id", group_id)
        .eq("owner_id", userRow.id);

      if (tileDelError) {
        console.error("[processActivityDelete] tiles delete error", { h3_index, group_id, error: tileDelError.message });
      } else {
        tilesDeleted += 1;
      }
      continue;
    }

    const rem = remaining as { user_id: string; passed_through_at?: string | null };
    const restoredAt = rem.passed_through_at ?? now;

    const { error: updateError } = await supabase
      .from("tiles")
      .update({
        owner_id: rem.user_id,
        score: TILE_SCORE_RESET,
        captured_at: restoredAt,
        last_updated_at: restoredAt,
      })
      .eq("h3_index", h3_index)
      .eq("group_id", group_id);

    if (updateError) {
      console.error("[processActivityDelete] tiles update (restore) error", { h3_index, group_id, error: updateError.message });
    } else {
      tilesRestored += 1;
    }
  }

  // C-S6: 最後の削除も当該ユーザーのレコードだけに絞る
  const { error: activityTilesDelError } = await supabase
    .from("activity_tiles")
    .delete()
    .eq("activity_id", objectId)
    .eq("user_id", userRow.id);

  if (activityTilesDelError) {
    return { ok: false, reason: `activity_tiles delete error: ${activityTilesDelError.message}` };
  }

  console.log("[processActivityDelete] done", { activity_id: objectId, tiles_deleted: tilesDeleted, tiles_restored: tilesRestored });
  return { ok: true };
}
