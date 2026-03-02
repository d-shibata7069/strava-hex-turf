"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  /** true の場合は親の aside 内に埋め込み表示（外側の aside を描画しない） */
  embedded?: boolean;
  /** 制御用。指定時は open で開閉を制御し、onOpenChange で通知する */
  open?: boolean;
  /** 開閉状態が変わったときに呼ばれる（制御用） */
  onOpenChange?: (open: boolean) => void;
}

function useFormatRelativeTime() {
  const t = useTranslations("time");
  const locale = useLocale();
  return function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return t("justNow");
    if (diffMin < 60) return t("minutesAgo", { n: diffMin });
    if (diffHour < 24) return t("hoursAgo", { n: diffHour });
    if (diffDay < 7) return t("daysAgo", { n: diffDay });
    return date.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };
}

export function ActivityTimeline({ groupId, initialLogs, defaultOpen = false, embedded = false, open: controlledOpen, onOpenChange }: ActivityTimelineProps) {
  const t = useTranslations("activityTimeline");
  const tCommon = useTranslations("common");
  const formatRelativeTime = useFormatRelativeTime();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (value: boolean) => onOpenChange(value) : setInternalOpen;
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
        setError(data.message ?? t("fetchError"));
        setLogs([]);
        return;
      }
      const data = (await res.json()) as ActivityLogEntry[];
      setLogs(Array.isArray(data) ? data.slice(0, MAX_LOGS) : []);
    } catch {
      setError(t("fetchError"));
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
    const content = (
      <>
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">{t("title")}</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-500">
          {t("joinToShow")}
        </div>
      </>
    );
    if (embedded) {
      return (
        <div className="flex flex-1 flex-col min-h-0" aria-label={t("title")}>
          {content}
        </div>
      );
    }
    return (
      <aside
        className="absolute right-0 top-0 z-10 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-200 bg-white/95 shadow-lg backdrop-blur sm:w-96"
        aria-label={t("title")}
      >
        {content}
      </aside>
    );
  }

  if (!isOpen) {
    const button = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-0 top-20 z-10 flex items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-white/95 p-2.5 shadow-md backdrop-blur transition hover:bg-gray-50"
        aria-label={t("openAria")}
        title={t("openAria")}
      >
        <List className="h-5 w-5 text-gray-600" aria-hidden />
      </button>
    );
    if (embedded) {
      return (
        <div className="flex shrink-0 flex-col overflow-hidden rounded-bl-lg border-b border-gray-200 py-1" aria-label={t("title")}>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center justify-center rounded-bl-lg border-r border-gray-200 bg-white/95 p-2.5 shadow-md backdrop-blur transition hover:bg-gray-100 focus:outline-none"
              aria-label={t("openAria")}
              title={t("openAria")}
            >
              <List className="h-5 w-5 text-gray-600" aria-hidden />
            </button>
          </div>
        </div>
      );
    }
    return button;
  }

  const openContent = (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">{t("title")}</h2>
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
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center p-6 text-sm text-gray-500">
            {tCommon("loading")}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-amber-700">{error}</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">
            {t("empty")}
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
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-label={t("title")}>
        {openContent}
      </div>
    );
  }

  return (
    <aside
      className="absolute right-0 top-0 z-10 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-200 bg-white/95 shadow-lg backdrop-blur sm:w-96"
      aria-label={t("title")}
    >
      {openContent}
    </aside>
  );
}
