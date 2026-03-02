"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";

interface Membership {
  group_id: string;
  group_name: string | null;
  invite_code: string | null;
}

export function MyGroupsView() {
  const t = useTranslations("groups");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/groups/memberships", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setError(t("fetchError"));
          return;
        }
        const data = (await res.json()) as Membership[];
        if (!cancelled) setMemberships(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLeave(groupId: string) {
    if (actioningId) return;
    setActioningId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/me`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        alert(data.message ?? t("leaveFailed"));
        return;
      }
      setMemberships((prev) => prev.filter((m) => m.group_id !== groupId));
      router.refresh();
    } catch {
      alert(t("networkError"));
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(groupId: string) {
    if (actioningId) return;
    if (!confirm(t("leaveConfirm"))) return;
    setActioningId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        alert(data.message ?? t("deleteFailed"));
        return;
      }
      setMemberships((prev) => prev.filter((m) => m.group_id !== groupId));
      router.refresh();
    } catch {
      alert(t("networkError"));
    } finally {
      setActioningId(null);
    }
  }

  async function handleCopyInviteCode(code: string, groupId: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedGroupId(groupId);
    window.setTimeout(() => setCopiedGroupId(null), 2000);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-zinc-500">{tCommon("loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900">{t("myGroupsTitle")}</h1>
      <p className="mb-6 text-sm text-zinc-600">
        {t("myGroupsDesc")}
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/groups/new"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          {t("createGroup")}
        </Link>
        <Link
          href="/join"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {t("joinWithCode")}
        </Link>
      </div>

      {memberships.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600">
          <p className="mb-4">{t("noGroupsYet")}</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/join"
              className="text-sm font-medium text-orange-500 hover:underline"
            >
              {t("joinWithCode")}
            </Link>
            <span className="text-zinc-400">{tCommon("or")}</span>
            <Link
              href="/groups/new"
              className="text-sm font-medium text-orange-500 hover:underline"
            >
              {t("createGroup")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {memberships.map((m) => (
            <li
              key={m.group_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900">
                  {m.group_name || t("noName")}
                </p>
                <p className="text-sm text-zinc-500">
                  {t("inviteCode")}{" "}
                  <code className="rounded bg-zinc-100 px-1">{m.invite_code ?? "—"}</code>
                  {m.invite_code && (
                    <button
                      type="button"
                      onClick={() => handleCopyInviteCode(m.invite_code!, m.group_id)}
                      className="ml-1.5 inline-flex items-center gap-1 rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
                      title={copiedGroupId === m.group_id ? t("copied") : t("copyCode")}
                    >
                      {copiedGroupId === m.group_id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLeave(m.group_id)}
                  disabled={!!actioningId}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {actioningId === m.group_id ? t("processing") : t("leave")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.group_id)}
                  disabled={!!actioningId}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="mt-6 inline-block text-sm text-zinc-500 hover:text-zinc-700"
      >
        {tCommon("backToTop")}
      </Link>
    </main>
  );
}
