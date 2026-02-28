"use client";

import { useMemo } from "react";
import { Map as MapLibreMap, Source, Layer } from "@vis.gl/react-maplibre";
import { latLngToCell, gridDisk } from "h3-js";
import "maplibre-gl/dist/maplibre-gl.css";
import { h3IndexesToGeoJSONFeatureCollection } from "@/lib/h3-geojson";

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

/** モック用 H3 インデックス（Resolution 7）：新宿付近のセル数個 */
function getMockH3Indexes(): string[] {
  const center = latLngToCell(35.6896, 139.6917, 7);
  return gridDisk(center, 1);
}

export function Map() {
  const geojsonData = useMemo(() => {
    const h3Indexes = getMockH3Indexes();
    return h3IndexesToGeoJSONFeatureCollection(h3Indexes);
  }, []);

  return (
    <div className="absolute inset-0">
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
            "fill-opacity": 0.35,
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
