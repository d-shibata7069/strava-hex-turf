/**
 * BFF: グループ作成・参加ロジック（招待コード生成リトライ含む）
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const INVITE_CODE_BYTES = 4;
const MAX_RETRIES = 5;

function generateInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString("hex");
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
      .insert({ name, invite_code: inviteCode })
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

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (groupError) {
    return { ok: false, statusCode: 500, error: groupError.message };
  }
  if (!group?.id) {
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
  return { ok: true, group_id: group.id };
}
