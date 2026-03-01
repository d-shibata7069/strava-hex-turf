import { getSupabaseServer } from "./supabase";

/**
 * ユーザーが所属するグループのタイル一覧（h3_index）を取得する。
 * サーバーコンポーネントまたは API Route からのみ使用すること。
 */
export async function getTilesH3IndexesForUser(
  userId: string
): Promise<string[]> {
  const supabase = getSupabaseServer();

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (membersError || !members?.length) {
    return [];
  }

  const groupIds = members.map((r) => r.group_id);

  const { data: tiles, error: tilesError } = await supabase
    .from("tiles")
    .select("h3_index")
    .in("group_id", groupIds);

  if (tilesError || !tiles?.length) {
    return [];
  }

  return [...new Set(tiles.map((t) => t.h3_index))];
}
