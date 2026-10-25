/**
 * プライバシーゾーン（users.privacy_zone）による領地化除外ユーティリティ（A-6 / Issue #62）
 *
 * users.privacy_zone は GEOMETRY(Polygon, 4326) で、PostgREST 経由では
 * GeoJSON 形式（Polygon / MultiPolygon）で返る想定。
 * GeoJSON の座標は [lng, lat] 順であることに注意（H3 や Polyline の [lat, lng] とは逆）。
 *
 * ここでは純関数のみを提供する:
 * - 点がゾーン内かどうか（レイキャスティング法による point-in-polygon 判定）
 * - H3 セルの中心座標がゾーン内にあるセルを、領地化対象のセル集合から除外する
 */
import { cellToLatLng, isValidCell } from "h3-js";

/** GeoJSON の座標ペア [lng, lat] */
export type LngLat = [number, number];

/** GeoJSON Polygon（coordinates[0] が外周リング、以降は穴リング） */
export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: LngLat[][];
}

/** GeoJSON MultiPolygon */
export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: LngLat[][][];
}

/** privacy_zone として扱うジオメトリ */
export type PrivacyZoneGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

/** 座標ペアとして妥当かどうか */
function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/** リング（座標ペアの配列）として妥当かどうか。最低 3 点必要 */
function isRing(value: unknown): value is LngLat[] {
  return Array.isArray(value) && value.length >= 3 && value.every(isLngLat);
}

/** ポリゴン（リングの配列）として妥当かどうか */
function isPolygonCoordinates(value: unknown): value is LngLat[][] {
  return Array.isArray(value) && value.length >= 1 && value.every(isRing);
}

/**
 * 任意の値を PrivacyZoneGeometry として解釈する。
 * Polygon / MultiPolygon 以外、または構造が不正な場合は null を返す
 * （= ゾーンなしとして扱い、従来どおり全セルを領地化対象にする）。
 */
export function parsePrivacyZone(value: unknown): PrivacyZoneGeometry | null {
  if (typeof value !== "object" || value === null) return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type === "Polygon" && isPolygonCoordinates(geometry.coordinates)) {
    return { type: "Polygon", coordinates: geometry.coordinates };
  }
  if (
    geometry.type === "MultiPolygon" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 1 &&
    geometry.coordinates.every(isPolygonCoordinates)
  ) {
    return { type: "MultiPolygon", coordinates: geometry.coordinates as LngLat[][][] };
  }
  return null;
}

/**
 * 点がリング内にあるかをレイキャスティング法で判定する。
 * 点から +lng 方向に半直線を引き、リングの辺との交差回数の偶奇で内外を判定する。
 * リングの最初と最後が同一点で閉じている場合（GeoJSON の通常形式）も、
 * 閉じていない場合も扱える。境界上の点の判定は不定（内外どちらにもなりうる）。
 */
export function isPointInRing(point: LngLat, ring: ReadonlyArray<LngLat>): boolean {
  const [x, y] = point;
  let inside = false;
  // 辺 (j -> i) を走査する。閉じたリングでは最後の辺が自動的にスキップされる
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // 辺が点の緯度をまたぎ、かつ交点が点より東（+lng）にある場合に交差と数える
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * 点がポリゴン内にあるかを判定する。
 * 外周リングの内側にあり、穴リングの内側にはない場合に true。
 */
export function isPointInPolygon(
  point: LngLat,
  polygon: ReadonlyArray<ReadonlyArray<LngLat>>
): boolean {
  if (polygon.length === 0) return false;
  if (!isPointInRing(point, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) {
    if (isPointInRing(point, polygon[k])) return false;
  }
  return true;
}

/**
 * 点 [lng, lat] がプライバシーゾーン内にあるかを判定する。
 * ゾーンが null / 不正な形式の場合は false（ゾーンなし扱い）。
 */
export function isPointInPrivacyZone(
  point: LngLat,
  zone: PrivacyZoneGeometry | null | undefined
): boolean {
  if (!zone) return false;
  if (zone.type === "Polygon") {
    return isPointInPolygon(point, zone.coordinates);
  }
  return zone.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}

/**
 * H3 セルの中心座標を [lng, lat] で返す。
 * セルとして解釈できない場合は null。
 */
export function getH3CellCenterLngLat(h3Index: string): LngLat | null {
  // cellToLatLng は不正な文字列でも例外にならないため、事前に妥当性を検証する
  if (!isValidCell(h3Index)) return null;
  try {
    const [lat, lng] = cellToLatLng(h3Index);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lng, lat];
  } catch {
    return null;
  }
}

/**
 * 領地化対象の H3 セル集合から、プライバシーゾーン内のセルを除外する。
 * 判定は各セルの中心座標がゾーン内にあるかどうかで行う。
 *
 * @param h3Indexes - 領地化候補の H3 インデックス配列
 * @param zone - users.privacy_zone（GeoJSON）。null / 不正な形式なら除外しない
 * @returns kept: ゾーン外のセル（元の順序を保持）, excludedCount: 除外した件数
 */
export function filterH3IndexesOutsidePrivacyZone(
  h3Indexes: ReadonlyArray<string>,
  zone: unknown
): { kept: string[]; excludedCount: number } {
  const parsed = parsePrivacyZone(zone);
  if (!parsed) {
    return { kept: [...h3Indexes], excludedCount: 0 };
  }
  const kept: string[] = [];
  let excludedCount = 0;
  for (const h3Index of h3Indexes) {
    const center = getH3CellCenterLngLat(h3Index);
    if (center && isPointInPrivacyZone(center, parsed)) {
      excludedCount += 1;
    } else {
      kept.push(h3Index);
    }
  }
  return { kept, excludedCount };
}
