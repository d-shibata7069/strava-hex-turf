"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { Avatar } from "@/components/atoms/Avatar";
import type { LeaderboardEntry } from "@/app/api/groups/[id]/leaderboard/route";

export interface LeaderboardProps {
  /** 表示するランキングのグループID。null の場合はプレースホルダーのみ表示 */
  groupId: string | null;
  /** Storybook 等で視覚確認するためのダミーデータ。指定時は API フェッチを行わない */
  initialEntries?: LeaderboardEntry[] | null;
}

function RankCrown({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="text-amber-500" aria-hidden>
        <Crown className="h-5 w-5" fill="currentColor" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="text-gray-400" aria-hidden>
        <Crown className="h-4 w-4" fill="currentColor" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="text-amber-700" aria-hidden>
        <Crown className="h-4 w-4" fill="currentColor" />
      </span>
    );
  }
  return null;
}

export function Leaderboard({ groupId, initialEntries }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialEntries === undefined);

  const fetchLeaderboard = useCallback(async () => {
    if (!groupId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/leaderboard`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setEntries([]);
          return;
        }
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? "ランキングの取得に失敗しました");
        setEntries([]);
        return;
      }
      const data = (await res.json()) as LeaderboardEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError("ランキングの取得に失敗しました");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (initialEntries !== undefined && initialEntries !== null) {
      setEntries(initialEntries);
      setLoading(false);
      return;
    }
    if (!groupId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchLeaderboard();
  }, [groupId, initialEntries, fetchLeaderboard]);

  if (groupId == null) {
    return (
      <div className="border-b border-gray-200 px-4 py-3" aria-label="リーダーボード">
        <h2 className="text-sm font-semibold text-gray-800">ランキング</h2>
        <div className="mt-2 text-center text-sm text-gray-500">
          グループに参加するとランキングが表示されます
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 px-4 py-3" aria-label="リーダーボード">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
        ランキング
      </h2>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-500">
            読み込み中…
          </div>
        ) : error ? (
          <div className="py-2 text-sm text-amber-700">{error}</div>
        ) : entries.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-500">
            まだタイルがありません
          </div>
        ) : (
          <ol className="space-y-1.5">
            {entries.map((entry, index) => {
              const rank = index + 1;
              const tileCount = typeof entry.tile_count === "string" ? entry.tile_count : String(entry.tile_count ?? 0);
              return (
                <li
                  key={entry.user_id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    rank <= 3 ? "bg-gray-50" : ""
                  }`}
                >
                  <span className="flex w-6 shrink-0 items-center justify-center">
                    {rank <= 3 ? (
                      <RankCrown rank={rank} />
                    ) : (
                      <span className="text-xs font-medium text-gray-500" aria-label={`${rank}位`}>
                        {rank}
                      </span>
                    )}
                  </span>
                  {rank <= 3 && (
                    <span className="w-5 shrink-0 text-right text-xs font-bold text-gray-600">
                      {rank}
                    </span>
                  )}
                  <Avatar
                    src={entry.icon_url ?? null}
                    alt=""
                    size="sm"
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                    {entry.display_name || "名前なし"}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-green-700" aria-label={`${tileCount}タイル`}>
                    {tileCount}
                    <span className="ml-0.5 text-xs font-normal text-gray-500">タイル</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
