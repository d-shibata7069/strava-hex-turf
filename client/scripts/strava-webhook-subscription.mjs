/**
 * Strava Webhook 購読の作成・確認・削除（環境変数でトークン等を指定）
 * 使い方: node scripts/strava-webhook-subscription.mjs <create|view|delete> [subscription_id]
 * 環境変数は .env.local から自動読み込み（client 直下で実行すること）。
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, "..");
const envPath = join(clientRoot, ".env.local");

function loadEnvLocal() {
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();

const STRAVA_API = "https://www.strava.com/api/v3/push_subscriptions";

function getEnv(name, alt) {
  const v = process.env[name] ?? process.env[alt];
  if (!v) throw new Error(`環境変数 ${name}（または ${alt}）を設定してください。`);
  return v;
}

async function create() {
  const clientId = getEnv("NEXT_PUBLIC_STRAVA_CLIENT_ID", "STRAVA_CLIENT_ID");
  const clientSecret = getEnv("STRAVA_CLIENT_SECRET");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.STRAVA_WEBHOOK_CALLBACK_URL;
  const callbackUrl = baseUrl
    ? (baseUrl.includes("/api/") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/api/strava/webhook`)
    : null;
  if (!callbackUrl) throw new Error("NEXT_PUBLIC_APP_URL または STRAVA_WEBHOOK_CALLBACK_URL を設定してください。");
  const verifyToken = getEnv("STRAVA_WEBHOOK_VERIFY_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });

  const res = await fetch(STRAVA_API, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("購読の作成に失敗しました:", res.status, data);
    process.exit(1);
  }
  console.log("購読を作成しました:", JSON.stringify(data, null, 2));
  if (data.id) console.log("削除する場合: npm run webhook:subscription:delete --", data.id);
}

async function view() {
  const clientId = getEnv("NEXT_PUBLIC_STRAVA_CLIENT_ID", "STRAVA_CLIENT_ID");
  const clientSecret = getEnv("STRAVA_CLIENT_SECRET");
  const url = `${STRAVA_API}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("購読の取得に失敗しました:", res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

async function del(subscriptionId) {
  const id = subscriptionId ?? process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID;
  if (!id) throw new Error("削除する購読 ID を指定してください: node scripts/strava-webhook-subscription.mjs delete <id> または環境変数 STRAVA_WEBHOOK_SUBSCRIPTION_ID");
  const clientId = getEnv("NEXT_PUBLIC_STRAVA_CLIENT_ID", "STRAVA_CLIENT_ID");
  const clientSecret = getEnv("STRAVA_CLIENT_SECRET");
  const url = `${STRAVA_API}/${id}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (res.status === 204) {
    console.log("購読を削除しました (id:", id, ")");
    return;
  }
  const data = await res.json().catch(() => ({}));
  console.error("削除に失敗しました:", res.status, data);
  process.exit(1);
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (!cmd || !["create", "view", "delete"].includes(cmd)) {
  console.log("使い方: node scripts/strava-webhook-subscription.mjs <create|view|delete> [subscription_id]");
  console.log("  create  - 購読を作成（.env.local の NEXT_PUBLIC_APP_URL + /api/strava/webhook が callback_url）");
  console.log("  view    - 現在の購読を表示");
  console.log("  delete  - 購読を削除（ID は引数または STRAVA_WEBHOOK_SUBSCRIPTION_ID）");
  process.exit(1);
}

if (cmd === "create") create();
else if (cmd === "view") view();
else if (cmd === "delete") del(arg);
