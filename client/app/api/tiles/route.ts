import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getTilesH3IndexesForUser } from "@/lib/tiles";

/**
 * GET /api/tiles
 * ログインユーザーが所属するグループのタイル（h3_index 一覧）を返す。
 * 地図のポーリング更新用。
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h3Indexes = await getTilesH3IndexesForUser(userId);
  return NextResponse.json({ h3Indexes });
}
