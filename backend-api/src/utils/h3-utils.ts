import { latLngToCell } from "h3-js";

const H3_RESOLUTION = 7;

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 緯度経度の配列を受け取り、重複を排除したH3インデックス（Resolution 7）の配列を返す。
 *
 * @param points - 緯度経度オブジェクトの配列
 * @returns 重複排除済みのH3インデックス文字列配列
 */
export function getH3IndexesFromPoints(points: LatLng[]): string[] {
  const indexSet = new Set<string>();

  for (const { lat, lng } of points) {
    const h3Index = latLngToCell(lat, lng, H3_RESOLUTION);
    indexSet.add(h3Index);
  }

  return Array.from(indexSet);
}
