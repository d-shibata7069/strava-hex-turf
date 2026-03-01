/**
 * H3インデックスをGeoJSONに変換するユーティリティ
 * docs/srd.md: Resolution 7 を採用。フロントエンドでの地図描画用。
 * @see https://www.npmjs.com/package/h3-js
 * @see https://h3geo.org/docs/api/indexing
 */
import { cellsToMultiPolygon, cellToLatLng, isValidCell } from "h3-js";
import { stringToColor } from "./color-utils";

/** GeoJSON Feature（Geometry は MultiPolygon） */
export interface H3GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSON.MultiPolygon;
  properties: Record<string, unknown>;
}

/** GeoJSON FeatureCollection */
export interface H3GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: H3GeoJSONFeature[];
}

/**
 * H3インデックスの配列を GeoJSON FeatureCollection（MultiPolygon）に変換する
 * cellsToMultiPolygon の戻り値は [lng, lat] の閉じたループで GeoJSON 準拠
 * 無効な H3 インデックスは除外する。セルごとに cellsToMultiPolygon を呼ぶ（複数渡すと隣接セルがマージされるため）。
 *
 * @param h3Indexes - H3インデックス（同一解像度・重複なしを想定）
 * @returns GeoJSON FeatureCollection（1 Feature = 1 ポリゴン）
 */
export function h3IndexesToGeoJSONFeatureCollection(
  h3Indexes: string[]
): H3GeoJSONFeatureCollection {
  if (h3Indexes.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const validIndexes = h3Indexes.filter(
    (idx) => typeof idx === "string" && idx.length > 0 && isValidCell(idx)
  );
  if (validIndexes.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  try {
    const features: H3GeoJSONFeature[] = [];
    for (const h3 of validIndexes) {
      const multiPolygonCoords = cellsToMultiPolygon([h3], true);
      const polygon = multiPolygonCoords?.[0];
      if (!polygon) continue;
      features.push({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: [polygon],
        },
        properties: {},
      });
    }
    return {
      type: "FeatureCollection",
      features,
    };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

/** API から取得するタイル1件の型（h3_index, owner_id, score, group_id, icon_url, display_name, last_updated_at） */
export interface TileRecord {
  h3_index: string;
  owner_id: string;
  score: number;
  group_id: string;
  icon_url?: string | null;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（取得/防衛日時・ツールチップ表示用） */
  last_updated_at?: string | null;
}

/** タイル用 GeoJSON Feature の properties（地図の fill-opacity / fill-color などで参照） */
export interface TileFeatureProperties {
  score: number;
  owner_id: string;
  group_id: string;
  /** ユーザー（owner_id）識別用の固有HEXカラー */
  color: string;
  /** 所有者のアバター画像URL（ズーム時シンボル表示用） */
  icon_url?: string | null;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（ツールチップ表示用） */
  last_updated_at?: string | null;
}

/**
 * タイルレコード配列を GeoJSON FeatureCollection に変換する。
 * 各 Feature の properties に score, owner_id, group_id を含め、スコアに応じた描画に利用する。
 * 無効な H3 インデックスは除外する。同一 h3_index の重複はユニーク化し、
 * cellsToMultiPolygon はセルごとに1回ずつ呼ぶ（複数セルを渡すと隣接セルが1つにマージされるため）。
 */
export function tilesToGeoJSONFeatureCollection(
  tiles: TileRecord[]
): H3GeoJSONFeatureCollection {
  if (tiles.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const validTiles = tiles.filter(
    (t) =>
      t &&
      typeof t.h3_index === "string" &&
      t.h3_index.length > 0 &&
      isValidCell(t.h3_index)
  );
  if (validTiles.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const uniqueIndexes: string[] = [];
  const seen = new Set<string>();
  for (const t of validTiles) {
    if (!seen.has(t.h3_index)) {
      seen.add(t.h3_index);
      uniqueIndexes.push(t.h3_index);
    }
  }

  try {
    const h3IndexToPolygon = new Map<string, number[][][]>();
    for (const h3 of uniqueIndexes) {
      const multiPolygonCoords = cellsToMultiPolygon([h3], true);
      const polygon = multiPolygonCoords?.[0];
      if (polygon) h3IndexToPolygon.set(h3, polygon);
    }

    const features = validTiles
      .map((tile) => {
        const polygon = h3IndexToPolygon.get(tile.h3_index);
        if (!polygon) return null;
        return {
          type: "Feature" as const,
          geometry: {
            type: "MultiPolygon" as const,
            coordinates: [polygon],
          },
          properties: {
            score: tile.score,
            owner_id: tile.owner_id,
            group_id: tile.group_id,
            color: stringToColor(tile.owner_id),
            icon_url: tile.icon_url ?? null,
            display_name: tile.display_name ?? null,
            last_updated_at: tile.last_updated_at ?? null,
          } as TileFeatureProperties & Record<string, unknown>,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null) as H3GeoJSONFeature[];

    return {
      type: "FeatureCollection",
      features,
    };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

/** アイコン表示用の Point Feature の properties（icon_url は URL またはデフォルトアイコンID） */
export interface TileIconPointProperties {
  icon_url: string;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（ツールチップ表示用） */
  last_updated_at?: string | null;
}

/** デフォルトアイコン（プロフィール未設定時）の MapLibre 画像ID */
export const DEFAULT_ICON_ID = "default-avatar";

/** GeoJSON Point FeatureCollection（タイル中心のポイント。全タイルを含め、icon_url がない場合は DEFAULT_ICON_ID を使用） */
export interface TileIconPointFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Point;
    properties: TileIconPointProperties;
  }>;
}

/**
 * タイルの中心座標を Point FeatureCollection で返す。
 * 全タイルを含め、icon_url が無い場合は DEFAULT_ICON_ID を指定してデフォルトアイコンを表示する。
 * cellToLatLng は [lat, lng] を返すため、GeoJSON の [lng, lat] に変換する。
 */
export function tilesToIconPointFeatureCollection(
  tiles: TileRecord[]
): TileIconPointFeatureCollection {
  const features: Array<{
    type: "Feature";
    geometry: GeoJSON.Point;
    properties: TileIconPointProperties;
  }> = [];
  for (const t of tiles) {
    if (!t || typeof t.h3_index !== "string" || !t.h3_index || !isValidCell(t.h3_index)) continue;
    const iconUrl =
      t.icon_url && typeof t.icon_url === "string" && t.icon_url.trim()
        ? t.icon_url.trim()
        : DEFAULT_ICON_ID;
    try {
      const [lat, lng] = cellToLatLng(t.h3_index);
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          icon_url: iconUrl,
          display_name: t.display_name ?? null,
          last_updated_at: t.last_updated_at ?? null,
        },
      });
    } catch {
      // 無効なセルはスキップ
    }
  }
  return { type: "FeatureCollection", features };
}
