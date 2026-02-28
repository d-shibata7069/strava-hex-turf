import { describe, it, expect } from "vitest";
import { getH3IndexesFromPoints, H3_RESOLUTION } from "./h3-utils.js";

describe("getH3IndexesFromPoints", () => {
  it("空配列の場合は空配列を返す", () => {
    expect(getH3IndexesFromPoints([])).toEqual([]);
  });

  it("単一ポイントの場合は1件のH3インデックスを返す", () => {
    const points: [number, number][] = [[35.6812, 139.7671]]; // 東京駅付近
    const result = getH3IndexesFromPoints(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^[0-9a-f]{15}$/); // H3 Resolution 7は15文字の16進文字列
  });

  it("同一タイル内の複数ポイントは重複排除されて1件になる", () => {
    // 同一H3セル内の近接2点（東京駅付近、約100m程度）
    const points: [number, number][] = [
      [35.6812, 139.7671],
      [35.6815, 139.7675],
    ];
    const result = getH3IndexesFromPoints(points);
    expect(result).toHaveLength(1);
  });

  it("異なるタイルの複数ポイントは全て返る", () => {
    // 東京と大阪（明らかに別タイル）
    const points: [number, number][] = [
      [35.6812, 139.7671], // 東京
      [34.7024, 135.4959], // 大阪
    ];
    const result = getH3IndexesFromPoints(points);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect([...new Set(result)].length).toBe(result.length); // 重複なし
  });

  it("Resolution 7のH3インデックス形式で返す", () => {
    const points: [number, number][] = [[37.3615593, -122.0553238]]; // h3-jsの公式サンプル座標
    const result = getH3IndexesFromPoints(points);
    expect(result[0]).toBe("87283472bffffff"); // h3-js v4のlatLngToCell期待値
  });
});

describe("H3_RESOLUTION", () => {
  it("Resolution 7が採用されていること", () => {
    expect(H3_RESOLUTION).toBe(7);
  });
});
