/**
 * BFF: グループ作成・参加ロジック（招待コード生成リトライ含む）
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// 招待コードは 72bit（9 バイト → 18 桁 hex）。旧仕様の 32bit（8 桁）では
// 試行回数制限と組み合わせても総当たりの余地があったため拡張した（A-7 / B-12）。
// 照合は文字列一致のみのため、既存発行済みの 8 桁コードもそのまま参加に使える。
const INVITE_CODE_BYTES = 9;
const MAX_RETRIES = 5;

function generateInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString("hex");
}

// 招待コード総当たり対策の簡易スロットリング（メモリ内）。
// 同一 user_id の参加失敗（コード不一致）が JOIN_MAX_FAILURES 回に達したら
// JOIN_LOCK_MS の間ロックする。プロセス再起動でリセットされる簡易実装であり、
// 永続化や複数プロセス間での共有は行わない。
const JOIN_MAX_FAILURES = 5;
const JOIN_LOCK_MS = 15 * 60 * 1000;

interface JoinFailureState {
  count: number;
  lockedUntil: number | null;
}

const joinFailures = new Map<string, JoinFailureState>();

function isJoinLocked(userId: string, now: number): boolean {
  const state = joinFailures.get(userId);
  if (!state || state.lockedUntil == null) return false;
  if (now < state.lockedUntil) return true;
  // ロック期限切れのため状態を破棄する
  joinFailures.delete(userId);
  return false;
}

function recordJoinFailure(userId: string, now: number): void {
  const state = joinFailures.get(userId) ?? { count: 0, lockedUntil: null };
  state.count += 1;
  if (state.count >= JOIN_MAX_FAILURES) {
    state.lockedUntil = now + JOIN_LOCK_MS;
  }
  joinFailures.set(userId, state);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(s: string): boolean {
  return typeof s === "string" && UUID_REGEX.test(s);
}

export interface CreateGroupBody {
  name: string;
  user_id: string;
}

export type CreateGroupResult =
  | { ok: true; group_id: string; name: string; invite_code: string }
  | { ok: false; statusCode: number; error: string };

export async function createGroup(
  supabase: SupabaseClient,
  body: CreateGroupBody
): Promise<CreateGroupResult> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { ok: false, statusCode: 400, error: "Missing or invalid name" };
  }
  if (!isValidUUID(body.user_id)) {
    return { ok: false, statusCode: 400, error: "Missing or invalid user_id" };
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const inviteCode = generateInviteCode();
    const { data: newGroup, error: insertGroupError } = await supabase
      .from("groups")
      // created_by に作成者を記録する（グループ削除の権限判定に使う。A-8）
      .insert({ name, invite_code: inviteCode, created_by: body.user_id })
      .select("id, name, invite_code")
      .single();

    if (!insertGroupError) {
      const { error: insertMemberError } = await supabase
        .from("group_members")
        .insert({ group_id: newGroup.id, user_id: body.user_id });

      if (insertMemberError) {
        return { ok: false, statusCode: 500, error: insertMemberError.message };
      }
      return {
        ok: true,
        group_id: newGroup.id,
        name: newGroup.name,
        invite_code: newGroup.invite_code,
      };
    }

    if (insertGroupError.code === "23505") {
      lastError = insertGroupError;
      continue;
    }
    return { ok: false, statusCode: 500, error: insertGroupError.message };
  }

  return {
    ok: false,
    statusCode: 409,
    error: "Invite code conflict after retries",
  };
}

export interface JoinGroupBody {
  invite_code: string;
  user_id: string;
}

export type JoinGroupResult =
  | { ok: true; group_id: string }
  | { ok: false; statusCode: number; error: string };

export async function joinGroup(
  supabase: SupabaseClient,
  body: JoinGroupBody
): Promise<JoinGroupResult> {
  const inviteCode =
    typeof body.invite_code === "string" ? body.invite_code.trim() : "";
  if (!inviteCode) {
    return { ok: false, statusCode: 400, error: "Missing or invalid invite_code" };
  }
  if (!isValidUUID(body.user_id)) {
    return { ok: false, statusCode: 400, error: "Missing or invalid user_id" };
  }

  if (isJoinLocked(body.user_id, Date.now())) {
    return {
      ok: false,
      statusCode: 429,
      error: "Too many failed attempts. Try again later.",
    };
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (groupError) {
    return { ok: false, statusCode: 500, error: groupError.message };
  }
  if (!group?.id) {
    // コード不一致のみを失敗として数える（DB エラー等は数えない）
    recordJoinFailure(body.user_id, Date.now());
    return { ok: false, statusCode: 404, error: "Group not found" };
  }

  const { error: insertError } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: body.user_id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, statusCode: 409, error: "Already a member" };
    }
    return { ok: false, statusCode: 500, error: insertError.message };
  }
  // 参加成功時は失敗カウントをリセットする
  joinFailures.delete(body.user_id);
  return { ok: true, group_id: group.id };
}
