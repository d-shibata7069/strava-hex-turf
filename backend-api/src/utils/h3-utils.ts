/**
 * H3インデックス計算ユーティリティ
 * docs/srd.md: Resolution 7（一辺約1.2km、面積約5㎢）を採用
 * @see https://www.npmjs.com/package/h3-js
 * @see https://h3geo.org/docs/api/indexing
 */
import { latLngToCell } from "h3-js";

/** H3 Resolution 7: 一辺約1.2km、面積約5㎢ */
export const H3_RESOLUTION = 7 as const;

/**
 * 緯度経度配列から重複排除されたH3インデックス配列を返す
 * @param points - [lat, lng] の配列
 * @returns 重複排除されたH3インデックス（Resolution 7）の配列
 */
export function getH3IndexesFromPoints(
  points: ReadonlyArray<[number, number]>
): string[] {
  const indexes = new Set<string>();

  for (const [lat, lng] of points) {
    const h3Index = latLngToCell(lat, lng, H3_RESOLUTION);
    indexes.add(h3Index);
  }

  return Array.from(indexes);
}
