"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/atoms/Avatar";
import type { MyActivityLogEntry } from "@/app/api/me/activity-logs/route";

const POLL_INTERVAL_MS = 30_000;
const MAX_LOGS = 30;
const STORAGE_KEY_READ_AT = "strava_hex_notification_read_at";

function getLastReadAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY_READ_AT);
    if (!s) return null;
    const t = new Date(s).getTime();
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

function setLastReadAt(ms: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_READ_AT, new Date(ms).toISOString());
  } catch {
    // ignore
  }
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
    return date.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };
}

/**
 * ヘッダー用の通知ベル。クリックでドロップダウンを開き、参加グループの Activity Log を表示する（Strava の通知風）。
 */
export function NotificationBell() {
  const t = useTranslations("notification");
  const tCommon = useTranslations("common");
  const formatRelativeTime = useFormatRelativeTime();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<MyActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReadAt, setLastReadAtState] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = lastReadAt == null
    ? logs.length
    : logs.filter((log) => new Date(log.created_at).getTime() > lastReadAt).length;
  const showBadge = unreadCount > 0;

  const fetchLogs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/me/activity-logs", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setLogs([]);
          return;
        }
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? t("fetchError"));
        setLogs([]);
        return;
      }
      const data = (await res.json()) as MyActivityLogEntry[];
      setLogs(Array.isArray(data) ? data.slice(0, MAX_LOGS) : []);
    } catch {
      setError(t("fetchError"));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLastReadAtState(getLastReadAt());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchLogs();
      const interval = setInterval(fetchLogs, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (!isOpen) return;
    const readAt = Date.now();
    setLastReadAt(readAt);
    setLastReadAtState(readAt);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="relative flex items-center justify-center rounded-full p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        aria-label={isOpen ? t("closeAria") : t("openAria")}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {showBadge && (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 max-h-[min(24rem,70vh)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          role="dialog"
          aria-label={t("title")}
        >
          <div className="border-b border-gray-200 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-800">{t("title")}</h2>
          </div>
          <div className="overflow-y-auto max-h-[min(22rem,calc(70vh-2.5rem))]">
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                {tCommon("loading")}
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-sm text-amber-700">{error}</div>
            ) : logs.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">
                {t("empty")}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <li key={log.id} className="px-3 py-2.5">
                    <div className="flex gap-2.5">
                      <Avatar
                        src={log.user?.icon_url ?? null}
                        alt=""
                        size="sm"
                        className="shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">{log.message}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                          {log.group_name && (
                            <span className="truncate">{log.group_name}</span>
                          )}
                          <span>{formatRelativeTime(log.created_at)}</span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
