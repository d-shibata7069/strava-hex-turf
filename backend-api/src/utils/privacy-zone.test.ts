import { describe, it, expect } from "vitest";
import { latLngToCell } from "h3-js";
import {
  parsePrivacyZone,
  isPointInRing,
  isPointInPolygon,
  isPointInPrivacyZone,
  getH3CellCenterLngLat,
  filterH3IndexesOutsidePrivacyZone,
  type GeoJsonPolygon,
  type LngLat,
} from "./privacy-zone.js";

/** 東京駅周辺を囲む矩形ゾーン（GeoJSON 形式、座標は [lng, lat] 順） */
const TOKYO_ZONE: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [139.75, 35.67],
      [139.78, 35.67],
      [139.78, 35.7],
      [139.75, 35.7],
      [139.75, 35.67], // GeoJSON のリングは最初と最後が同一点で閉じる
    ],
  ],
};

/** 東京駅のセル（ゾーン内）と大阪駅のセル（ゾーン外） */
const TOKYO_CELL = latLngToCell(35.6812, 139.7671, 7);
const OSAKA_CELL = latLngToCell(34.7024, 135.4959, 7);

describe("isPointInRing", () => {
  const ring = TOKYO_ZONE.coordinates[0];

  it("リング内の点は true", () => {
    expect(isPointInRing([139.7671, 35.6812], ring)).toBe(true); // 東京駅 [lng, lat]
  });

  it("リング外の点は false", () => {
    expect(isPointInRing([135.4959, 34.7024], ring)).toBe(false); // 大阪駅
    expect(isPointInRing([139.7671, 35.8], ring)).toBe(false); // ゾーンの北側
    expect(isPointInRing([139.9, 35.6812], ring)).toBe(false); // ゾーンの東側
  });

  it("閉じていないリングでも判定できる", () => {
    const openRing: LngLat[] = [
      [139.75, 35.67],
      [139.78, 35.67],
      [139.78, 35.7],
      [139.75, 35.7],
    ];
    expect(isPointInRing([139.7671, 35.6812], openRing)).toBe(true);
    expect(isPointInRing([135.4959, 34.7024], openRing)).toBe(false);
  });
});

describe("isPointInPolygon", () => {
  it("穴リング内の点は false（除外される）", () => {
    const polygonWithHole: LngLat[][] = [
      TOKYO_ZONE.coordinates[0],
      [
        [139.76, 35.68],
        [139.77, 35.68],
        [139.77, 35.69],
        [139.76, 35.69],
        [139.76, 35.68],
      ],
    ];
    expect(isPointInPolygon([139.765, 35.685], polygonWithHole)).toBe(false); // 穴の中
    expect(isPointInPolygon([139.755, 35.675], polygonWithHole)).toBe(true); // 穴の外・外周の内
  });
});

describe("isPointInPrivacyZone", () => {
  it("Polygon 内の点は true、外の点は false", () => {
    expect(isPointInPrivacyZone([139.7671, 35.6812], TOKYO_ZONE)).toBe(true);
    expect(isPointInPrivacyZone([135.4959, 34.7024], TOKYO_ZONE)).toBe(false);
  });

  it("MultiPolygon はいずれかのポリゴン内なら true", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [
        TOKYO_ZONE.coordinates,
        [
          [
            [135.48, 34.69],
            [135.51, 34.69],
            [135.51, 34.72],
            [135.48, 34.72],
            [135.48, 34.69],
          ],
        ],
      ],
    };
    expect(isPointInPrivacyZone([139.7671, 35.6812], multi)).toBe(true);
    expect(isPointInPrivacyZone([135.4959, 34.7024], multi)).toBe(true);
    expect(isPointInPrivacyZone([140.0, 36.0], multi)).toBe(false);
  });

  it("ゾーンが null / undefined の場合は false", () => {
    expect(isPointInPrivacyZone([139.7671, 35.6812], null)).toBe(false);
    expect(isPointInPrivacyZone([139.7671, 35.6812], undefined)).toBe(false);
  });
});

describe("parsePrivacyZone", () => {
  it("妥当な Polygon / MultiPolygon を解釈できる", () => {
    expect(parsePrivacyZone(TOKYO_ZONE)).toEqual(TOKYO_ZONE);
    const multi = { type: "MultiPolygon", coordinates: [TOKYO_ZONE.coordinates] };
    expect(parsePrivacyZone(multi)).toEqual(multi);
  });

  it("null や不正な形式は null を返す", () => {
    expect(parsePrivacyZone(null)).toBeNull();
    expect(parsePrivacyZone(undefined)).toBeNull();
    expect(parsePrivacyZone("polygon")).toBeNull();
    expect(parsePrivacyZone({ type: "Point", coordinates: [139.7, 35.6] })).toBeNull();
    expect(parsePrivacyZone({ type: "Polygon", coordinates: [] })).toBeNull();
    expect(parsePrivacyZone({ type: "Polygon", coordinates: [[[139.7, 35.6]]] })).toBeNull();
  });
});

describe("getH3CellCenterLngLat", () => {
  it("セルの中心を [lng, lat] 順で返す", () => {
    const center = getH3CellCenterLngLat(TOKYO_CELL);
    expect(center).not.toBeNull();
    // 東京駅のセルなので経度 139.x / 緯度 35.x の順になっていること
    expect(center![0]).toBeGreaterThan(139);
    expect(center![1]).toBeGreaterThan(35);
    expect(center![1]).toBeLessThan(36);
  });

  it("不正なセルは null を返す", () => {
    expect(getH3CellCenterLngLat("not-a-cell")).toBeNull();
  });
});

describe("filterH3IndexesOutsidePrivacyZone", () => {
  it("ゾーン内のセルを除外し、ゾーン外のセルだけが残る", () => {
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(
      [TOKYO_CELL, OSAKA_CELL],
      TOKYO_ZONE
    );
    expect(kept).toEqual([OSAKA_CELL]);
    expect(excludedCount).toBe(1);
  });

  it("全セルがゾーン内の場合は全件除外される", () => {
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(
      [TOKYO_CELL],
      TOKYO_ZONE
    );
    expect(kept).toEqual([]);
    expect(excludedCount).toBe(1);
  });

  it("ゾーン外のセルだけなら全件残る", () => {
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(
      [OSAKA_CELL],
      TOKYO_ZONE
    );
    expect(kept).toEqual([OSAKA_CELL]);
    expect(excludedCount).toBe(0);
  });

  it("null ゾーンでは全件残る（従来通り）", () => {
    const cells = [TOKYO_CELL, OSAKA_CELL];
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(cells, null);
    expect(kept).toEqual(cells);
    expect(excludedCount).toBe(0);
  });

  it("不正な形式のゾーンでは全件残る", () => {
    const cells = [TOKYO_CELL, OSAKA_CELL];
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(cells, {
      type: "Polygon",
      coordinates: "invalid",
    });
    expect(kept).toEqual(cells);
    expect(excludedCount).toBe(0);
  });

  it("MultiPolygon のゾーンでも除外できる", () => {
    const multi = {
      type: "MultiPolygon",
      coordinates: [TOKYO_ZONE.coordinates],
    };
    const { kept, excludedCount } = filterH3IndexesOutsidePrivacyZone(
      [TOKYO_CELL, OSAKA_CELL],
      multi
    );
    expect(kept).toEqual([OSAKA_CELL]);
    expect(excludedCount).toBe(1);
  });

  it("空配列は空のまま返る", () => {
    expect(filterH3IndexesOutsidePrivacyZone([], TOKYO_ZONE)).toEqual({
      kept: [],
      excludedCount: 0,
    });
  });
});
