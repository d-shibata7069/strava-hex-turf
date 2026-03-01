"use client";

import { useCallback, useEffect, useState } from "react";
import { List } from "lucide-react";
import type { ActivityLogEntry } from "@/app/api/groups/[id]/logs/route";

const LOGS_POLL_INTERVAL_MS = 20_000;
const MAX_LOGS = 50;

export interface ActivityTimelineProps {
  /** 表示するログのグループID。null の場合は「グループに参加すると…」のみ表示 */
  groupId: string | null;
  /** Storybook 等で視覚確認するためのダミーログ。指定時は API フェッチを行わずこのデータを表示 */
  initialLogs?: ActivityLogEntry[] | null;
  /** 初期表示でパネルを開くか。デフォルトは false（閉じる） */
  defaultOpen?: boolean;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function ActivityTimeline({ groupId, initialLogs, defaultOpen = false }: ActivityTimelineProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [logs, setLogs] = useState<ActivityLogEntry[]>(initialLogs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialLogs === undefined);

  const fetchLogs = useCallback(async () => {
    if (!groupId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/logs`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setLogs([]);
          return;
        }
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? "ログの取得に失敗しました");
        setLogs([]);
        return;
      }
      const data = (await res.json()) as ActivityLogEntry[];
      setLogs(Array.isArray(data) ? data.slice(0, MAX_LOGS) : []);
    } catch {
      setError("ログの取得に失敗しました");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (initialLogs !== undefined && initialLogs !== null) {
      setLogs(initialLogs);
      setLoading(false);
      return;
    }
    if (!groupId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchLogs();
    const interval = setInterval(() => {
      if (!cancelled) void fetchLogs();
    }, LOGS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [groupId, fetchLogs, initialLogs]);

  if (groupId == null) {
    return (
      <aside
        className="absolute right-0 top-0 z-10 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-200 bg-white/95 shadow-lg backdrop-blur sm:w-96"
        aria-label="Activity Log"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Activity Log</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-500">
          グループに参加するとタイムラインが表示されます
        </div>
      </aside>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="absolute right-0 top-20 z-10 flex items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-white/95 p-2.5 shadow-md backdrop-blur transition hover:bg-gray-50"
        aria-label="Activity Log を開く"
        title="Activity Log を開く"
      >
        <List className="h-5 w-5 text-gray-600" aria-hidden />
      </button>
    );
  }

  return (
    <aside
      className="absolute right-0 top-0 z-10 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-200 bg-white/95 shadow-lg backdrop-blur sm:w-96"
      aria-label="Activity Log"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Activity Log</h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Activity Log を閉じる"
          title="閉じる"
        >
          <span className="text-lg leading-none" aria-hidden>×</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center p-6 text-sm text-gray-500">
            読み込み中…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-amber-700">{error}</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">
            まだログはありません
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
                    {log.user?.icon_url ? (
                      <img
                        src={log.user.icon_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-500"
                        aria-hidden
                      >
                        {(log.user?.display_name ?? "?")[0]}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{log.message}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatRelativeTime(log.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
