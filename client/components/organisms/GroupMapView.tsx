"use client";

import { useState } from "react";
import { Map } from "./Map";
import { ActivityTimeline } from "./ActivityTimeline";

export interface MembershipItem {
  group_id: string;
  group_name: string | null;
  invite_code?: string | null;
}

export interface GroupMapViewProps {
  /** 所属グループ一覧。空の場合は「グループに参加してください」を表示 */
  memberships: MembershipItem[];
}

export function GroupMapView({ memberships }: GroupMapViewProps) {
  const firstGroupId = memberships[0]?.group_id ?? null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(firstGroupId);

  if (memberships.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <p className="text-center text-gray-600">
          グループに参加すると地図が表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-20">
        <label htmlFor="group-select" className="sr-only">
          表示するグループ
        </label>
        <select
          id="group-select"
          value={selectedGroupId ?? ""}
          onChange={(e) => setSelectedGroupId(e.target.value || null)}
          className="rounded border border-gray-300 bg-white/95 px-3 py-2 text-sm shadow backdrop-blur focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {memberships.map((m) => (
            <option key={m.group_id} value={m.group_id}>
              {m.group_name ?? "グループ"}
            </option>
          ))}
        </select>
      </div>
      <Map groupId={selectedGroupId} />
      <ActivityTimeline groupId={selectedGroupId} />
    </div>
  );
}
