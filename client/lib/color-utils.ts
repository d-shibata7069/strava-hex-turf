/**
 * 文字列から一意のHEXカラーを生成するユーティリティ。
 * 地図上のH3タイルのユーザー（owner_id）識別用。同じ文字列は常に同じ色を返す。
 */

/**
 * 文字列をハッシュして 0 以上 max 未満の整数を返す（djb2 風）。
 */
function hashString(str: string, max: number): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) >>> 0;
  }
  return Math.abs(hash) % max;
}

/**
 * HSL (H: 0-360, S/L: 0-100) を #RRGGBB に変換する。
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const r = Math.round(255 * Math.max(0, Math.min(1, f(0))));
  const g = Math.round(255 * Math.max(0, Math.min(1, f(8))));
  const b = Math.round(255 * Math.max(0, Math.min(1, f(4))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 文字列（例: owner_id の UUID）から、常に同じ一意のHEXカラーコードを返す。
 * 地図上で視認しやすいよう、彩度・明度を一定範囲に抑えた色を生成する。
 *
 * @param str - 入力文字列（UUID など）
 * @returns #RRGGBB 形式のHEXカラーコード
 */
export function stringToColor(str: string): string {
  const hue = hashString(str, 360);
  const saturation = 65 + (hashString(str + "s", 16)); // 65–80%
  const lightness = 42 + (hashString(str + "l", 18));  // 42–59%
  return hslToHex(hue, saturation, lightness);
}
