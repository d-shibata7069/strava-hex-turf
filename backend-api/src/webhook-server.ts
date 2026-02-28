/**
 * Webhook 用 HTTP サーバ（POST /webhook/activity で processActivityEvent を実行）
 * クライアント（Next.js API Route）から呼び出される。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import {
  processActivityEvent,
  createDefaultDeps,
} from "./services/strava-webhook.js";

const PORT = Number(process.env.PORT) || 3001;
const PATH = "/webhook/activity";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key);
}

function parseBody(req: IncomingMessage): Promise<{ object_id: number; owner_id: number } | null> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(data) as unknown;
        if (
          body &&
          typeof (body as { object_id?: number }).object_id === "number" &&
          typeof (body as { owner_id?: number }).owner_id === "number"
        ) {
          resolve({
            object_id: (body as { object_id: number }).object_id,
            owner_id: (body as { owner_id: number }).owner_id,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseBody(req);
  if (!body) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid object_id, owner_id" }));
    return;
  }
  const supabase = getSupabase();
  const deps = createDefaultDeps(supabase);
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
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

function notFound(res: ServerResponse): void {
  res.writeHead(404);
  res.end();
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === PATH) {
    await handlePost(req, res);
  } else {
    notFound(res);
  }
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on http://localhost:${PORT}${PATH}`);
});
