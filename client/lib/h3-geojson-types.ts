/**
 * H3/GeoJSON まわりの型定義（h3-js に依存しないためクライアントバンドルで利用可能）
 * 変換ロジックは h3-geojson.ts（サーバー・Storybook のみ）を参照。
 */

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

/** API から取得するタイル1件の型（h3_index, owner_id, score, group_id, icon_url, display_name, last_updated_at） */
export interface TileRecord {
  h3_index: string;
  owner_id: string;
  score: number;
  group_id: string;
  icon_url?: string | null;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（取得/防衛日時・ツールチップ表示用） */
  last_updated_at?: string | null;
}

/** タイル用 GeoJSON Feature の properties（地図の fill-opacity / fill-color などで参照） */
export interface TileFeatureProperties {
  score: number;
  owner_id: string;
  group_id: string;
  /** ユーザー（owner_id）識別用の固有HEXカラー */
  color: string;
  /** 所有者のアバター画像URL（ズーム時シンボル表示用） */
  icon_url?: string | null;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（ツールチップ表示用） */
  last_updated_at?: string | null;
  /** タイル中心の経度（Popup の固定表示位置用） */
  longitude: number;
  /** タイル中心の緯度（Popup の固定表示位置用） */
  latitude: number;
}

/** アイコン表示用の Point Feature の properties（icon_url は URL またはデフォルトアイコンID） */
export interface TileIconPointProperties {
  icon_url: string;
  /** 所有者の表示名（ツールチップ表示用） */
  display_name?: string | null;
  /** 最終更新日時 ISO 文字列（ツールチップ表示用） */
  last_updated_at?: string | null;
  /** スコア（ツールチップ表示用） */
  score?: number | null;
}

/** デフォルトアイコン（プロフィール未設定時）の MapLibre 画像ID */
export const DEFAULT_ICON_ID = "default-avatar";

/** GeoJSON Point FeatureCollection（タイル中心のポイント） */
export interface TileIconPointFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Point;
    properties: TileIconPointProperties;
  }>;
}
