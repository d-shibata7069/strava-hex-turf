"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapLibreMap, Source, Layer } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DataDrivenPropertyValueSpecification } from "maplibre-gl";
import {
  tilesToGeoJSONFeatureCollection,
  type TileRecord,
  type H3GeoJSONFeatureCollection,
} from "@/lib/h3-geojson";

const TILES_POLL_INTERVAL_MS = 15_000;

/** 空の GeoJSON（タイル未取得時・未ログイン時） */
const EMPTY_GEOJSON: H3GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * スコア（0–100）に応じた fill-opacity の式。
 * score 100 → 0.8、score 0 → 0.2 で線形補間（防衛の濃さを表現）。
 * @see https://maplibre.org/maplibre-style-spec/expressions/#interpolate
 */
const FILL_OPACITY_BY_SCORE: DataDrivenPropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["get", "score"],
  0,
  0.2,
  100,
  0.8,
];

/** 東京都新宿区周辺の初期表示（経度・緯度・ズーム） */
const INITIAL_VIEW_STATE = {
  longitude: 139.6917,
  latitude: 35.6896,
  zoom: 12,
} as const;

/**
 * ベース地図用スタイル（ラスタータイルのみ）。
 * 外部ベクトルタイルに依存せず、OSM ラスターで確実に地図を表示する。
 * @see https://operations.osmfoundation.org/policies/tiles/
 */
const BASE_MAP_STYLE = {
  version: 8 as const,
  name: "OSM Raster",
  sources: {
    "osm-raster": {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster" as const,
      source: "osm-raster",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export interface MapProps {
  /**
   * 省略時は /api/tiles から取得。Storybook などでモックデータを渡す場合に使用。
   */
  initialTiles?: TileRecord[] | null;
}

export function Map({ initialTiles }: MapProps = {}) {
  const [tiles, setTiles] = useState<TileRecord[]>(initialTiles ?? []);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refetchTiles = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch("/api/tiles", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setTiles([]);
          return;
        }
        const data = (await res.json()) as { message?: string; detail?: string };
        setFetchError(data.detail ?? data.message ?? "タイルの取得に失敗しました");
        setTiles([]);
        return;
      }
      const data = (await res.json()) as TileRecord[];
      setTiles(Array.isArray(data) ? data : []);
    } catch {
      setFetchError("タイルの取得に失敗しました");
      setTiles([]);
    }
  }, []);

  useEffect(() => {
    if (initialTiles !== undefined) {
      setTiles(initialTiles ?? []);
      return;
    }

    let cancelled = false;

    async function loadTiles() {
      setFetchError(null);
      try {
        const res = await fetch("/api/tiles", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) setTiles([]);
            return;
          }
          const data = (await res.json()) as { message?: string; detail?: string };
          if (!cancelled) {
            setFetchError(data.detail ?? data.message ?? "タイルの取得に失敗しました");
            setTiles([]);
          }
          return;
        }
        const data = (await res.json()) as TileRecord[];
        if (!cancelled) setTiles(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setFetchError("タイルの取得に失敗しました");
          setTiles([]);
        }
      }
    }

    loadTiles();
    return () => {
      cancelled = true;
    };
  }, [initialTiles]);

  useEffect(() => {
    if (initialTiles !== undefined) return;

    const interval = setInterval(refetchTiles, TILES_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [initialTiles, refetchTiles]);

  useEffect(() => {
    if (initialTiles !== undefined) return;

    const onFocus = () => void refetchTiles();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [initialTiles, refetchTiles]);

  const geojsonData = useMemo(() => {
    if (tiles.length === 0) return EMPTY_GEOJSON;
    return tilesToGeoJSONFeatureCollection(tiles);
  }, [tiles]);

  return (
    <div className="absolute inset-0">
      {fetchError && (
        <div className="absolute top-2 left-2 right-2 z-10 rounded bg-amber-100 px-3 py-2 text-sm text-amber-800">
          {fetchError}
        </div>
      )}
      <MapLibreMap
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={BASE_MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        <Source
          id="h3-hex-source"
          type="geojson"
          data={geojsonData}
        />
        <Layer
          id="h3-hex-fill"
          type="fill"
          source="h3-hex-source"
          paint={{
            "fill-color": "#22c55e",
            "fill-opacity": FILL_OPACITY_BY_SCORE,
          }}
        />
        <Layer
          id="h3-hex-outline"
          type="line"
          source="h3-hex-source"
          paint={{
            "line-color": "#15803d",
            "line-width": 1.5,
          }}
        />
      </MapLibreMap>
    </div>
  );
}
