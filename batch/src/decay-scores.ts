/**
 * タイルスコア減衰バッチ。
 * Supabase RPC decay_tile_scores を呼び出し、tiles の score を
 * last_updated_at からの経過日数に応じて 30 日で 100→0 に線形減衰させる。
 *
 * 実行: npm run build && npm run start:decay
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

export interface DecayScoresDeps {
  rpc: (name: string) => Promise<{ error: { message: string } | null }>;
}

/**
 * RPC decay_tile_scores を呼び出す。テスト・CLI 両方から利用可能。
 */
export async function runDecayScores(
  deps: DecayScoresDeps
): Promise<{ success: boolean; error?: string }> {
  const { error } = await deps.rpc("decay_tile_scores");
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

async function main(): Promise<void> {
  const start = Date.now();
  console.log("[decay-scores] 開始");

  try {
    const supabase = getSupabase();
    const result = await runDecayScores({
      rpc: (name) =>
        Promise.resolve(
          supabase.rpc(name as "decay_tile_scores").then((res) => ({
            error: res.error
              ? { message: res.error.message }
              : null,
          }))
        ),
    });

    if (!result.success) {
      console.error("[decay-scores] 失敗:", result.error);
      process.exit(1);
    }

    const elapsed = Date.now() - start;
    console.log("[decay-scores] 成功 処理時間:", elapsed, "ms");
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error("[decay-scores] 異常終了:", err);
    console.error("[decay-scores] 処理時間:", elapsed, "ms");
    process.exit(1);
  }
}

const isEntryScript =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryScript) {
  main();
}
