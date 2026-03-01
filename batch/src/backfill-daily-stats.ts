/**
 * 日次スナップショットのバックフィル（手動単体実行）。
 * Supabase RPC backfill_user_group_daily_stats を呼び出し、
 * 全員分の過去 1week / 1month / 1year の日次スナップショットを user_group_daily_stats に投入する。
 *
 * 実行: npm run build && npm run start:backfill-daily-stats [1week|1month|1year]
 * 省略時は 1month。
 * 環境変数: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（batch 直下の .env または .env.local）
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromCwd(): void {
  const cwd = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    break;
  }
}
loadEnvFromCwd();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export type BackfillRange = "1week" | "1month" | "1year";

const RANGE_DAYS: Record<BackfillRange, number> = {
  "1week": 7,
  "1month": 30,
  "1year": 365,
};

function parseRange(arg: string | undefined): BackfillRange {
  const v = (arg ?? "1month").toLowerCase();
  if (v === "1week" || v === "1w") return "1week";
  if (v === "1month" || v === "1m") return "1month";
  if (v === "1year" || v === "1y") return "1year";
  return "1month";
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface BackfillDailyStatsDeps {
  rpc: (name: string, params: { p_start_date: string; p_end_date: string }) => Promise<{ error: { message: string } | null }>;
}

/**
 * backfill_user_group_daily_stats RPC を呼び出す。テスト・CLI 両方から利用可能。
 */
export async function runBackfillDailyStats(
  deps: BackfillDailyStatsDeps,
  range: BackfillRange
): Promise<{ success: boolean; error?: string }> {
  const days = RANGE_DAYS[range];
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const p_start_date = toDateString(startDate);
  const p_end_date = toDateString(endDate);

  const { error } = await deps.rpc("backfill_user_group_daily_stats", {
    p_start_date,
    p_end_date,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

async function main(): Promise<void> {
  const start = Date.now();
  const rangeArg = process.argv[2];
  const range = parseRange(rangeArg);
  const days = RANGE_DAYS[range];
  console.log("[backfill-daily-stats] 開始 range=%s (%d 日分)", range, days);

  try {
    const supabase = getSupabase();
    const result = await runBackfillDailyStats(
      {
        rpc: async (name, params) => {
          const res = await supabase.rpc(name as "backfill_user_group_daily_stats", params);
          return { error: res.error ? { message: res.error.message } : null };
        },
      },
      range
    );

    if (!result.success) {
      console.error("[backfill-daily-stats] 失敗:", result.error);
      process.exit(1);
    }

    const elapsed = Date.now() - start;
    console.log("[backfill-daily-stats] 成功 処理時間:", elapsed, "ms");
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error("[backfill-daily-stats] 異常終了:", err);
    console.error("[backfill-daily-stats] 処理時間:", elapsed, "ms");
    process.exit(1);
  }
}

const isEntryScript =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryScript) {
  main();
}
