import { describe, it, expect } from "vitest";
import { getH3IndexesFromPoints } from "./h3-utils";

describe("getH3IndexesFromPoints", () => {
  it("単一の座標から1つのH3インデックスを返す", () => {
    const points = [{ lat: 35.6812, lng: 139.7671 }];
    const result = getH3IndexesFromPoints(points);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^[0-9a-f]{15}$/);
  });

  it("同一タイル内の複数座標は重複排除される", () => {
    const points = [
      { lat: 35.6812, lng: 139.7671 },
      { lat: 35.6813, lng: 139.7672 },
    ];
    const result = getH3IndexesFromPoints(points);

    expect(result).toHaveLength(1);
  });

  it("異なるタイルの座標は別々のインデックスとして返る", () => {
    const points = [
      { lat: 35.6812, lng: 139.7671 },
      { lat: 34.6937, lng: 135.5023 },
    ];
    const result = getH3IndexesFromPoints(points);

    expect(result).toHaveLength(2);
    expect(result[0]).not.toBe(result[1]);
  });

  it("空の配列を渡すと空の配列を返す", () => {
    const result = getH3IndexesFromPoints([]);

    expect(result).toEqual([]);
  });

  it("返されるインデックスはResolution 7である", () => {
    const { getResolution } = require("h3-js");
    const points = [{ lat: 35.6812, lng: 139.7671 }];
    const result = getH3IndexesFromPoints(points);

    expect(getResolution(result[0])).toBe(7);
  });
});
