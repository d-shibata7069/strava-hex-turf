import type { Meta, StoryObj } from "@storybook/react";
import { latLngToCell, gridDisk } from "h3-js";
import { Map } from "./Map";
import type { TileRecord } from "@/lib/h3-geojson-types";
import {
  tilesToGeoJSONFeatureCollection,
  tilesToIconPointFeatureCollection,
} from "@/lib/h3-geojson";

const meta: Meta<typeof Map> = {
  component: Map,
  title: "Organisms/Map",
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;

type Story = StoryObj<typeof Map>;

export const Default: Story = {
  render: () => (
    <div style={{ width: "100%", height: "500px" }}>
      <Map />
    </div>
  ),
};

/** 新宿付近のモックタイル（スコアの違いで濃さが変わることを確認用） */
function getMockTiles(): TileRecord[] {
  const center = latLngToCell(35.6896, 139.6917, 7);
  const h3Indexes = gridDisk(center, 1);
  const dummyOwnerId = "00000000-0000-0000-0000-000000000001";
  const dummyGroupId = "00000000-0000-0000-0000-000000000002";
  return h3Indexes.map((h3_index, i) => ({
    h3_index,
    owner_id: dummyOwnerId,
    group_id: dummyGroupId,
    score: i === 0 ? 100 : Math.max(0, 100 - i * 25),
  }));
}

export const WithMockTiles: Story = {
  render: () => {
    const mockTiles = getMockTiles();
    const tilesGeoJSON = tilesToGeoJSONFeatureCollection(mockTiles);
    const iconPointsGeoJSON = tilesToIconPointFeatureCollection(mockTiles);
    return (
      <div style={{ width: "100%", height: "500px" }}>
        <Map
          initialTilesGeoJSON={tilesGeoJSON}
          initialIconPointsGeoJSON={iconPointsGeoJSON}
        />
      </div>
    );
  },
};
