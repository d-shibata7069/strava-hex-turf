import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import {
  tilesToGeoJSONFeatureCollection,
  tilesToIconPointFeatureCollection,
} from "@/lib/h3-geojson";

/** GET /api/tiles: ログインユーザーが所属するグループのタイル一覧を返す（RLS相当をAPI側で実施） */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", message: "ログインが必要です" },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: memberships, error: membersError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (membersError) {
    console.error("group_members fetch error:", membersError);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "グループ取得に失敗しました",
        detail: membersError.message,
      },
      { status: 500 }
    );
  }

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) {
    const empty = { type: "FeatureCollection" as const, features: [] };
    return NextResponse.json({
      tilesGeoJSON: empty,
      iconPointsGeoJSON: empty,
    });
  }

  const { data: tilesRaw, error: tilesError } = await supabase
    .from("tiles")
    .select("h3_index, owner_id, score, group_id, last_updated_at, users!owner_id(icon_url, display_name)")
    .in("group_id", groupIds);

  if (tilesError) {
    console.error("tiles fetch error:", tilesError);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "タイル取得に失敗しました",
        detail: tilesError.message,
      },
      { status: 500 }
    );
  }

  const tiles = (tilesRaw ?? []).map(
    (row: {
      h3_index: string;
      owner_id: string;
      score: number;
      group_id: string;
      last_updated_at?: string | null;
      users?: { icon_url: string | null; display_name?: string | null } | { icon_url: string | null; display_name?: string | null }[] | null;
    }) => {
      const users = row.users;
      const iconUrl =
        users == null
          ? null
          : Array.isArray(users)
            ? users[0]?.icon_url ?? null
            : users.icon_url ?? null;
      const displayName =
        users == null
          ? null
          : Array.isArray(users)
            ? users[0]?.display_name ?? null
            : users.display_name ?? null;
      return {
        h3_index: row.h3_index,
        owner_id: row.owner_id,
        score: row.score,
        group_id: row.group_id,
        icon_url: iconUrl,
        display_name: displayName ?? undefined,
        last_updated_at: row.last_updated_at ?? undefined,
      };
    }
  );

  const tilesGeoJSON = tilesToGeoJSONFeatureCollection(tiles);
  const iconPointsGeoJSON = tilesToIconPointFeatureCollection(tiles);
  return NextResponse.json({ tilesGeoJSON, iconPointsGeoJSON });
}
