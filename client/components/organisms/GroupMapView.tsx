"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Map } from "./Map";
import { Leaderboard } from "./Leaderboard";

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
  const t = useTranslations("map");
  const firstGroupId = memberships[0]?.group_id ?? null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(firstGroupId);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const panelClosed = !leaderboardOpen;

  if (memberships.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <p className="text-center text-gray-600">
          {t("joinPrefix")}
          <Link href="/groups" className="font-medium text-green-600 underline hover:text-green-700">
            {t("joinLink")}
          </Link>
          {t("joinSuffix")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-20">
        <label htmlFor="group-select" className="sr-only">
          {t("groupSelectLabel")}
        </label>
        <select
          id="group-select"
          value={selectedGroupId ?? ""}
          onChange={(e) => setSelectedGroupId(e.target.value || null)}
          className="rounded border border-gray-300 bg-white/95 px-3 py-2 text-sm shadow backdrop-blur focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {memberships.map((m) => (
            <option key={m.group_id} value={m.group_id}>
              {m.group_name ?? t("defaultGroupName")}
            </option>
          ))}
        </select>
      </div>
      <Map groupId={selectedGroupId} />
      <aside
        className={`absolute right-0 top-0 z-10 flex flex-col border-l border-gray-200 bg-white/95 shadow-lg backdrop-blur ${
          panelClosed ? "rounded-l-lg overflow-hidden" : "h-full w-80 max-w-[85vw] sm:w-96"
        }`}
      >
        <Leaderboard
          groupId={selectedGroupId}
          open={leaderboardOpen}
          onOpenChange={setLeaderboardOpen}
        />
      </aside>
    </div>
  );
}
