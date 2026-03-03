/**
 * H3インデックスをGeoJSONに変換するユーティリティ（サーバー・Storybook 用。クライアントは API から GeoJSON を受け取る）
 * docs/srd.md: Resolution 7 を採用。
 * @see https://www.npmjs.com/package/h3-js
 * @see https://h3geo.org/docs/api/indexing
 */
import { cellsToMultiPolygon, cellToLatLng, isValidCell } from "h3-js";
import { stringToColor } from "./color-utils";
import {
  DEFAULT_ICON_ID,
  type H3GeoJSONFeature,
  type H3GeoJSONFeatureCollection,
  type TileRecord,
  type TileFeatureProperties,
  type TileIconPointProperties,
  type TileIconPointFeatureCollection,
} from "./h3-geojson-types";

export type {
  H3GeoJSONFeature,
  H3GeoJSONFeatureCollection,
  TileRecord,
  TileFeatureProperties,
  TileIconPointProperties,
  TileIconPointFeatureCollection,
} from "./h3-geojson-types";
export { DEFAULT_ICON_ID } from "./h3-geojson-types";

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
        const [lat, lng] = cellToLatLng(tile.h3_index);
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
            longitude: lng,
            latitude: lat,
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
          score: t.score ?? null,
        },
      });
    } catch {
      // 無効なセルはスキップ
    }
  }
  return { type: "FeatureCollection", features };
}
