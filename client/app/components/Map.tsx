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
    <div className="relative h-full w-full min-h-[400px]">
      <MapLibreMap
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: "100%", height: "100%", position: "absolute" }}
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
