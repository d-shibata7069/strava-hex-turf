/**
 * BFF: ユーザー情報の同期（トークン暗号化して users に upsert）
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsersSyncBody {
  strava_id: number;
  access_token: string;
  refresh_token: string;
  display_name?: string;
  profile_image_url?: string | null;
  icon_url?: string | null;
  strava_token_expires_at?: string | null;
}

export type UsersSyncResult =
  | { ok: true; id: string; should_run_initial_backfill: boolean }
  | { ok: false; statusCode: number; error: string };

export type EncryptFn = (plaintext: string) => string | null;

function isMissingInitialBackfillColumnError(err: { message?: string; details?: string; hint?: string } | null): boolean {
  if (!err) return false;
  const message = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`;
  return message.includes("initial_backfill_done_at") && message.includes("column");
}

export async function runUsersSync(
  supabase: SupabaseClient,
  body: UsersSyncBody,
  encrypt: EncryptFn
): Promise<UsersSyncResult> {
  if (
    typeof body.strava_id !== "number" ||
    typeof body.access_token !== "string" ||
    typeof body.refresh_token !== "string"
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: "Missing or invalid strava_id, access_token, refresh_token",
    };
  }

  const displayName =
    typeof body.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim()
      : `User ${body.strava_id}`;
  const iconUrl = body.profile_image_url ?? body.icon_url ?? null;
  const expiresAt =
    typeof body.strava_token_expires_at === "string" &&
    body.strava_token_expires_at
      ? body.strava_token_expires_at
      : null;

  const encryptedAccess = encrypt(body.access_token);
  const encryptedRefresh = encrypt(body.refresh_token);
  if (!encryptedAccess || !encryptedRefresh) {
    return { ok: false, statusCode: 500, error: "Token encryption failed" };
  }

  const row: Record<string, unknown> = {
    strava_id: body.strava_id,
    display_name: displayName,
    icon_url: iconUrl,
    strava_access_token: encryptedAccess,
    strava_refresh_token: encryptedRefresh,
    strava_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id, initial_backfill_done_at")
    .eq("strava_id", body.strava_id)
    .maybeSingle();

  if (existingUserError && !isMissingInitialBackfillColumnError(existingUserError)) {
    return { ok: false, statusCode: 500, error: existingUserError.message };
  }
  const shouldRunInitialBackfill = isMissingInitialBackfillColumnError(existingUserError)
    ? false
    : !existingUser ||
      !(
        typeof (existingUser as { initial_backfill_done_at?: string | null })
          .initial_backfill_done_at === "string" &&
        (existingUser as { initial_backfill_done_at?: string | null })
          .initial_backfill_done_at
      );

  const { data, error } = await supabase
    .from("users")
    .upsert(row, { onConflict: "strava_id" })
    .select("id")
    .single();

  if (error) {
    return { ok: false, statusCode: 500, error: error.message };
  }
  if (!data?.id || typeof data.id !== "string") {
    return { ok: false, statusCode: 500, error: "users upsert succeeded but id was missing" };
  }
  return { ok: true, id: data.id, should_run_initial_backfill: shouldRunInitialBackfill };
}
