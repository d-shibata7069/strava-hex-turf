"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Avatar } from "@/components/atoms/Avatar";
import type { UserGroupDailyStat } from "@/app/api/groups/[id]/users/[userId]/stats/route";
import { Users } from "lucide-react";

export interface UserStatsViewProps {
  groupId: string;
  userId: string;
  displayName: string;
  iconUrl: string | null;
  groupName?: string | null;
}

type RangeKey = "1W" | "1M" | "1Y";

const RANGE_DAYS: Record<RangeKey, number> = {
  "1W": 7,
  "1M": 30,
  "1Y": 365,
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function UserStatsView({ groupId, userId, displayName, iconUrl, groupName }: UserStatsViewProps) {
  const t = useTranslations("userStats");
  const tCommon = useTranslations("common");
  const [range, setRange] = useState<RangeKey>("1M");
  const [stats, setStats] = useState<UserGroupDailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}/stats`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? t("fetchError"));
        setStats([]);
        return;
      }
      const data = (await res.json()) as UserGroupDailyStat[];
      setStats(Array.isArray(data) ? data : []);
    } catch {
      setError(t("fetchError"));
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const days = RANGE_DAYS[range];
  const chartData = stats
    .slice(-days)
    .map((d) => ({
      ...d,
      dateLabel: formatDateLabel(d.record_date),
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <Avatar src={iconUrl} alt="" size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
            {groupName ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {groupName}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{t("statsSubtitle")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">{t("periodLabel")}</h2>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label={t("periodLabel")}>
            {(["1W", "1M", "1Y"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  range === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
                aria-pressed={range === key}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-500">{tCommon("loading")}</div>
        ) : error ? (
          <div className="py-8 text-center text-amber-700">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="py-8 text-center text-gray-500">{t("noData")}</div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-xs font-medium text-gray-600">{t("tileCountTrend")}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelFormatter={(label) => t("dateLabel", { date: label })}
                    formatter={(value: number | undefined) => [`${value ?? 0}`, t("tileCount")]}
                    labelStyle={{ color: "#374151" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tile_count"
                    name={t("tileCount")}
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ fill: "#059669", r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium text-gray-600">{t("totalScoreTrend")}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelFormatter={(label) => t("dateLabel", { date: label })}
                    formatter={(value: number | undefined) => [`${value ?? 0} pt`, t("totalScore")]}
                    labelStyle={{ color: "#374151" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_score"
                    name={t("totalScore")}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
