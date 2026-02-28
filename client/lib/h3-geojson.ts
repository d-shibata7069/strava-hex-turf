/**
 * H3インデックスをGeoJSONに変換するユーティリティ
 * docs/srd.md: Resolution 7 を採用。フロントエンドでの地図描画用。
 * @see https://www.npmjs.com/package/h3-js
 * @see https://h3geo.org/docs/api/indexing
 */
import { cellsToMultiPolygon } from "h3-js";

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

  const coordinates = cellsToMultiPolygon(h3Indexes, true);

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
}
