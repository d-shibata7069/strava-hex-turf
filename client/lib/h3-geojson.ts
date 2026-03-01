/**
 * H3インデックスをGeoJSONに変換するユーティリティ
 * docs/srd.md: Resolution 7 を採用。フロントエンドでの地図描画用。
 * @see https://www.npmjs.com/package/h3-js
 * @see https://h3geo.org/docs/api/indexing
 */
import { cellsToMultiPolygon, isValidCell } from "h3-js";

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
 * 無効な H3 インデックスは除外する。すべて無効な場合は空の FeatureCollection を返す。
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
    const coordinates = cellsToMultiPolygon(validIndexes, true);

    const features: H3GeoJSONFeature[] = coordinates.map((polygon) => ({
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [polygon],
      },
      properties: {},
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

/** API から取得するタイル1件の型（h3_index, owner_id, score, group_id） */
export interface TileRecord {
  h3_index: string;
  owner_id: string;
  score: number;
  group_id: string;
}

/** タイル用 GeoJSON Feature の properties（地図の fill-opacity などで参照） */
export interface TileFeatureProperties {
  score: number;
  owner_id: string;
  group_id: string;
}

/**
 * タイルレコード配列を GeoJSON FeatureCollection に変換する。
 * 各 Feature の properties に score, owner_id, group_id を含め、スコアに応じた描画に利用する。
 * 無効な H3 インデックスは除外する。cellsToMultiPolygon が失敗した場合は空の FeatureCollection を返す。
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

  const h3Indexes = validTiles.map((t) => t.h3_index);

  try {
    const coordinates = cellsToMultiPolygon(h3Indexes, true);

    const features: H3GeoJSONFeature[] = coordinates.map((polygon, i) => {
      const tile = validTiles[i];
      if (!tile) {
        return {
          type: "Feature" as const,
          geometry: {
            type: "MultiPolygon" as const,
            coordinates: [polygon],
          },
          properties: {} as Record<string, unknown>,
        };
      }
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
        } as TileFeatureProperties & Record<string, unknown>,
      };
    });

    return {
      type: "FeatureCollection",
      features,
    };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}
