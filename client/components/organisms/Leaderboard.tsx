"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Crown, Trophy } from "lucide-react";
import { Avatar } from "@/components/atoms/Avatar";
import type { LeaderboardEntry } from "@/app/api/groups/[id]/leaderboard/route";

export interface LeaderboardProps {
  /** 表示するランキングのグループID。null の場合はプレースホルダーのみ表示 */
  groupId: string | null;
  /** Storybook 等で視覚確認するためのダミーデータ。指定時は API フェッチを行わない */
  initialEntries?: LeaderboardEntry[] | null;
  /** 初期表示でパネルを開くか。デフォルトは true（開く） */
  defaultOpen?: boolean;
  /** 制御用。指定時は open で開閉を制御し、onOpenChange で通知する */
  open?: boolean;
  /** 開閉状態が変わったときに呼ばれる（制御用） */
  onOpenChange?: (open: boolean) => void;
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

export function Leaderboard({ groupId, initialEntries, defaultOpen = true, open: controlledOpen, onOpenChange }: LeaderboardProps) {
  const t = useTranslations("leaderboard");
  const tCommon = useTranslations("common");
  const tGroupUser = useTranslations("groupUser");
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (value: boolean) => onOpenChange(value) : setInternalOpen;
  const [sortBy, setSortBy] = useState<"tiles" | "score">("tiles");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialEntries === undefined);

  const sortedEntries = useMemo(() => {
    if (sortBy === "tiles") {
      return [...entries].sort((a, b) => {
        const va = Number(a.tile_count) ?? 0;
        const vb = Number(b.tile_count) ?? 0;
        return vb - va;
      });
    }
    return [...entries].sort((a, b) => {
      const va = Number(a.total_score) ?? 0;
      const vb = Number(b.total_score) ?? 0;
      return vb - va;
    });
  }, [entries, sortBy]);

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
        setError(data.message ?? t("fetchError"));
        setEntries([]);
        return;
      }
      const data = (await res.json()) as LeaderboardEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError(t("fetchError"));
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
      <div className="shrink-0 border-b border-gray-200 px-4 py-3" aria-label={t("title")}>
        <h2 className="text-sm font-semibold text-gray-800">{t("title")}</h2>
        <div className="mt-2 text-center text-sm text-gray-500">
          {t("joinToShow")}
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="flex shrink-0 justify-end overflow-hidden rounded-l-lg border-b border-gray-200 py-1" aria-label={t("title")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center rounded-l-lg border-r border-gray-200 bg-white/95 p-2.5 shadow-md backdrop-blur transition hover:bg-gray-100 focus:outline-none"
          aria-label={t("openAria")}
          title={t("openAria")}
        >
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-gray-200 px-4 py-3" aria-label={t("title")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={t("closeAria")}
          title={t("closeAria")}
        >
          <span className="text-lg leading-none" aria-hidden>×</span>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">{t("sortLabel")}</span>
        <div
          className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
          role="group"
          aria-label={t("sortBy")}
        >
          <button
            type="button"
            onClick={() => setSortBy("tiles")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              sortBy === "tiles" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            aria-pressed={sortBy === "tiles"}
          >
            {t("tilesCount")}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("score")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              sortBy === "score" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            aria-pressed={sortBy === "score"}
          >
            {t("totalScore")}
          </button>
        </div>
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-500">
            {tCommon("loading")}
          </div>
        ) : error ? (
          <div className="py-2 text-sm text-amber-700">{error}</div>
        ) : sortedEntries.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-500">
            {t("noTiles")}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {sortedEntries.map((entry, index) => {
              const rank = index + 1;
              const tileCount = typeof entry.tile_count === "string" ? entry.tile_count : String(entry.tile_count ?? 0);
              const scoreStr = typeof entry.total_score === "string" ? entry.total_score : String(entry.total_score ?? 0);
              const valueLabel = sortBy === "tiles" ? t("tilesValue", { count: tileCount }) : t("scoreValue", { score: scoreStr });
              const valueAria = sortBy === "tiles" ? t("tilesValue", { count: tileCount }) : t("scoreValue", { score: scoreStr });
              const displayName = entry.display_name || tGroupUser("noName");
              const userUrl = groupId ? `/groups/${groupId}/users/${entry.user_id}` : "#";
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
                  <Link
                    href={userUrl}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label={t("detailAria", { name: displayName })}
                  >
                    <Avatar
                      src={entry.icon_url ?? null}
                      alt=""
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                      {displayName}
                    </span>
                  </Link>
                  <span className="shrink-0 text-sm font-semibold text-green-700" aria-label={valueAria}>
                    {valueLabel}
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
