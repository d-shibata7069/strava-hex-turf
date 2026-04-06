/**
 * Webhook 用 HTTP サーバ（POST /webhook/activity で processActivityEvent を実行）
 * クライアント（Next.js API Route）から呼び出される。
 * 起動前に backend-api 直下の .env.local または .env を読み込み、Supabase の環境変数を使用する。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  processActivityEvent,
  processActivityDelete,
  createDefaultDeps,
} from "./services/strava-webhook.js";
import { decryptStravaToken, encryptStravaToken } from "./utils/token-crypto.js";
import { createGroup, joinGroup } from "./bff/groups.js";
import { runUsersSync, type UsersSyncBody } from "./bff/users-sync.js";

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    break;
  }
}
loadEnvFromCwd();

const PORT = Number(process.env.PORT) || 3001;
const PATH_WEBHOOK = "/webhook/activity";
const PATH_USERS_SYNC = "/users/sync";
const PATH_USERS_INITIAL_BACKFILL = "/users/initial-backfill";
const PATH_GROUPS = "/groups";
const PATH_GROUPS_JOIN = "/groups/join";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key);
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as T) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function parseWebhookBody(req: IncomingMessage): Promise<{ object_id: number; owner_id: number; action?: string } | null> {
  return parseJsonBody(req).then((body) => {
    if (
      body &&
      typeof (body as { object_id?: number }).object_id === "number" &&
      typeof (body as { owner_id?: number }).owner_id === "number"
    ) {
      return {
        object_id: (body as { object_id: number }).object_id,
        owner_id: (body as { owner_id: number }).owner_id,
        action: typeof (body as { action?: string }).action === "string" ? (body as { action: string }).action : undefined,
      };
    }
    return null;
  });
}

async function handleUsersSync(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody<UsersSyncBody>(req);
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }
  try {
    const result = await runUsersSync(getSupabase(), body, encryptStravaToken);
    if (result.ok) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          id: result.id,
          should_run_initial_backfill: result.should_run_initial_backfill,
        })
      );
      return;
    }
    res.writeHead(result.statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-server] users/sync error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
}

async function fetchRecentActivityIds(accessToken: string, days: number, baseTime: Date): Promise<number[]> {
  const baseSec = Math.floor(baseTime.getTime() / 1000);
  const afterSec = baseSec - days * 24 * 60 * 60;
  const perPage = 200;
  let page = 1;
  const ids: number[] = [];

  while (true) {
    const params = new URLSearchParams({
      after: String(afterSec),
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Strava athlete activities API ${res.status}: ${text}`);
    }
    const rows = (await res.json()) as Array<{ id?: number }>;
    const pageIds = rows
      .map((row) => row.id)
      .filter((id): id is number => typeof id === "number");
    ids.push(...pageIds);
    if (rows.length < perPage) break;
    page += 1;
  }

  return ids;
}

async function handleUsersInitialBackfill(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const expectedKey = process.env.INTERNAL_BACKFILL_API_KEY ?? "";
  const requestKey = req.headers["x-internal-backfill-key"];
  if (!expectedKey || requestKey !== expectedKey) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return;
  }

  const body = await parseJsonBody<{ strava_id?: number; base_time?: string }>(req);
  if (!body || typeof body.strava_id !== "number") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid strava_id" }));
    return;
  }
  const baseTime = body.base_time ? new Date(body.base_time) : new Date();
  if (Number.isNaN(baseTime.getTime())) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid base_time" }));
    return;
  }

  const supabase = getSupabase();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, strava_access_token, initial_backfill_done_at")
    .eq("strava_id", body.strava_id)
    .maybeSingle();

  if (userError) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: userError.message }));
    return;
  }
  if (!user) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "user not found" }));
    return;
  }

  const userRow = user as {
    id: string;
    strava_access_token: string | null;
    initial_backfill_done_at: string | null;
  };
  if (userRow.initial_backfill_done_at) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, skipped: true }));
    return;
  }
  if (!userRow.strava_access_token) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "user has no strava_access_token" }));
    return;
  }

  const token = decryptStravaToken(userRow.strava_access_token);
  if (!token) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "strava_access_token decryption failed" }));
    return;
  }

  try {
    const activityIds = await fetchRecentActivityIds(token, 7, baseTime);
    const deps = createDefaultDeps(supabase, decryptStravaToken);
    for (const activityId of activityIds) {
      const result = await processActivityEvent(activityId, body.strava_id, deps);
      if (result.ok || result.reason === "activity has no map.summary_polyline") continue;
      throw new Error(result.reason);
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ initial_backfill_done_at: new Date().toISOString() })
      .eq("id", userRow.id);
    if (updateError) throw new Error(updateError.message);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        processed_activity_count: activityIds.length,
        base_time: baseTime.toISOString(),
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-server] users/initial-backfill error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
}

async function handleGroupsCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody<{ name?: string; user_id?: string }>(req);
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }
  try {
    const result = await createGroup(getSupabase(), {
      name: body.name ?? "",
      user_id: body.user_id ?? "",
    });
    if (result.ok) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          group_id: result.group_id,
          name: result.name,
          invite_code: result.invite_code,
        })
      );
      return;
    }
    res.writeHead(result.statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-server] groups create error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
}

async function handleGroupsJoin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody<{ invite_code?: string; user_id?: string }>(req);
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }
  try {
    const result = await joinGroup(getSupabase(), {
      invite_code: body.invite_code ?? "",
      user_id: body.user_id ?? "",
    });
    if (result.ok) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, group_id: result.group_id }));
      return;
    }
    res.writeHead(result.statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-server] groups join error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseWebhookBody(req);
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid object_id, owner_id" }));
    return;
  }
  const isDelete = body.action === "delete";
  console.log("[webhook-server] received activity event", {
    object_id: body.object_id,
    owner_id: body.owner_id,
    action: isDelete ? "delete" : "create",
  });

  const supabase = getSupabase();

  if (isDelete) {
    const result = await processActivityDelete(
      body.object_id,
      body.owner_id,
      { supabase }
    );
    if (result.ok === false) {
      console.error("[webhook-server] processActivityDelete failed:", result.reason);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: result.reason }));
      return;
    }
    console.log("[webhook-server] processActivityDelete ok", { object_id: body.object_id });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const deps = createDefaultDeps(supabase, decryptStravaToken);
  try {
    const result = await processActivityEvent(
      body.object_id,
      body.owner_id,
      deps
    );
    if (result.ok === false) {
      console.error("[webhook-server] processActivityEvent failed:", result.reason);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: result.reason }));
      return;
    }
    console.log("[webhook-server] processActivityEvent ok", { object_id: body.object_id });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("Record Not Found")) {
      console.log("[webhook-server] activity 404 (deleted?), running processActivityDelete", { object_id: body.object_id });
      const delResult = await processActivityDelete(
        body.object_id,
        body.owner_id,
        { supabase }
      );
      if (delResult.ok === false) {
        console.error("[webhook-server] processActivityDelete failed:", delResult.reason);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: delResult.reason }));
        return;
      }
      console.log("[webhook-server] processActivityDelete ok (after 404)", { object_id: body.object_id });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    throw err;
  }
}

function notFound(res: ServerResponse): void {
  res.writeHead(404);
  res.end();
}

function getPath(url: string | undefined): string {
  if (!url) return "";
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

const server = createServer(async (req, res) => {
  const path = getPath(req.url);
  if (req.method === "POST" && path === PATH_WEBHOOK) {
    await handlePost(req, res);
  } else if (req.method === "POST" && path === PATH_USERS_SYNC) {
    await handleUsersSync(req, res);
  } else if (req.method === "POST" && path === PATH_USERS_INITIAL_BACKFILL) {
    await handleUsersInitialBackfill(req, res);
  } else if (req.method === "POST" && path === PATH_GROUPS) {
    await handleGroupsCreate(req, res);
  } else if (req.method === "POST" && path === PATH_GROUPS_JOIN) {
    await handleGroupsJoin(req, res);
  } else {
    notFound(res);
  }
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on http://localhost:${PORT}${PATH_WEBHOOK}`);
  console.log(`Users sync: http://localhost:${PORT}${PATH_USERS_SYNC}`);
  console.log(`Users initial backfill: http://localhost:${PORT}${PATH_USERS_INITIAL_BACKFILL}`);
  console.log(`Groups: http://localhost:${PORT}${PATH_GROUPS}, http://localhost:${PORT}${PATH_GROUPS_JOIN}`);
});
