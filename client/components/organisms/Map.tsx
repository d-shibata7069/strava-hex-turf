"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Source, Layer, useMap } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DataDrivenPropertyValueSpecification, FilterSpecification } from "maplibre-gl";
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
 * スコアを数値として取得（API が文字列で返す場合・null 対策）。
 * 欠損時は 100 として扱う。
 */
const SCORE_AS_NUMBER: DataDrivenPropertyValueSpecification<number> = [
  "coalesce",
  ["to-number", ["get", "score"]],
  100,
];

/**
 * スコア（0–100）に応じた fill-opacity。
 * 0→0、100→0.4 を均等に傾斜。
 */
const FILL_OPACITY_BY_SCORE: DataDrivenPropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  SCORE_AS_NUMBER,
  0,
  0,
  100,
  0.4,
];

/** 東京都新宿区周辺の初期表示（経度・緯度・ズーム） */
const INITIAL_VIEW_STATE = {
  longitude: 139.6917,
  latitude: 35.6896,
  zoom: 12,
} as const;

/** ユーザーアイコンをタイル中心に表示するシンボルレイヤー（minzoom: 14）。useMap で map を取得し、icon_url を動的登録する。 */
function TileIconLayer({ tiles }: { tiles: TileRecord[] }) {
  const maps = useMap();
  const mapRef = maps?.current;
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());

  const uniqueIconUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const t of tiles) {
      if (t.icon_url && t.icon_url.trim()) urls.add(t.icon_url.trim());
    }
    return Array.from(urls);
  }, [tiles]);

  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map || uniqueIconUrls.length === 0) return;

    const mapInstance = map;
    let cancelled = false;

    async function loadAndAddImages() {
      const nextLoaded = new Set(loadedUrlsRef.current);
      for (const url of uniqueIconUrls) {
        if (nextLoaded.has(url)) continue;
        try {
          const response = await mapInstance.loadImage(url);
          if (cancelled) return;
          const image = response.data;
          if (image && !mapInstance.hasImage(url)) {
            mapInstance.addImage(url, image);
          }
          nextLoaded.add(url);
        } catch {
          // 読み込み失敗（CORS等）はスキップ
        }
      }
      if (!cancelled) {
        loadedUrlsRef.current = nextLoaded;
        setLoadedUrls(new Set(nextLoaded));
      }
    }

    loadAndAddImages();
    return () => { cancelled = true; };
  }, [mapRef, uniqueIconUrls]);

  const filter: FilterSpecification | undefined = useMemo(() => {
    const list = Array.from(loadedUrls);
    if (list.length === 0) return ["==", ["get", "icon_url"], ""];
    return [
      "all",
      ["has", "icon_url"],
      ["in", ["get", "icon_url"], ["literal", list]],
    ] as FilterSpecification;
  }, [loadedUrls]);

  if (!mapRef) return null;

  return (
    <Layer
      id="h3-hex-user-icon"
      type="symbol"
      source="h3-hex-source"
      minzoom={14}
      layout={{
        "symbol-placement": "point",
        "icon-image": ["get", "icon_url"],
        "icon-size": 0.35,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      }}
      filter={filter}
    />
  );
}

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
   * 表示するグループID。指定時は /api/groups/[id]/tiles からそのグループのタイルのみ取得する。
   * null の場合はタイルを取得せず空の地図を表示する。
   */
  groupId?: string | null;
  /**
   * 省略時は groupId または /api/tiles から取得。Storybook などでモックデータを渡す場合に使用。
   */
  initialTiles?: TileRecord[] | null;
}

export function Map({ groupId, initialTiles }: MapProps = {}) {
  const [tiles, setTiles] = useState<TileRecord[]>(initialTiles ?? []);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refetchTiles = useCallback(async () => {
    if (groupId == null && initialTiles === undefined) {
      setTiles([]);
      return;
    }
    setFetchError(null);
    try {
      const url =
        groupId != null
          ? `/api/groups/${encodeURIComponent(groupId)}/tiles`
          : "/api/tiles";
      const res = await fetch(url, { credentials: "include" });
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
  }, [groupId, initialTiles]);

  useEffect(() => {
    if (initialTiles !== undefined) {
      setTiles(initialTiles ?? []);
      return;
    }
    if (groupId == null) {
      setTiles([]);
      setFetchError(null);
      return;
    }

    let cancelled = false;

    async function loadTiles() {
      setFetchError(null);
      try {
        const res = await fetch(`/api/groups/${encodeURIComponent(groupId!)}/tiles`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
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
  }, [groupId, initialTiles]);

  useEffect(() => {
    if (initialTiles !== undefined || groupId == null) return;

    const interval = setInterval(refetchTiles, TILES_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [initialTiles, groupId, refetchTiles]);

  useEffect(() => {
    if (initialTiles !== undefined || groupId == null) return;

    const onFocus = () => void refetchTiles();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [initialTiles, groupId, refetchTiles]);

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
            "fill-color": ["get", "color"],
            "fill-opacity": FILL_OPACITY_BY_SCORE,
          }}
        />
        <Layer
          id="h3-hex-outline"
          type="line"
          source="h3-hex-source"
          paint={{
            "line-color": ["get", "color"],
            "line-width": 1.5,
          }}
        />
        <Layer
          id="h3-hex-score-label"
          type="symbol"
          source="h3-hex-source"
          layout={{
            "text-field": ["to-string", ["get", "score"]],
            "text-size": 11,
            "text-anchor": "center",
          }}
          paint={{
            "text-color": "#052e16",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          }}
        />
        <TileIconLayer tiles={tiles} />
      </MapLibreMap>
    </div>
  );
}
