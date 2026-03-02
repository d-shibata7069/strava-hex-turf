"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Avatar } from "@/components/atoms";

export interface SettingsViewProps {
  displayName: string | null;
  iconUrl: string | null;
}

/**
 * アカウント設定画面。現在のユーザー情報、将来の拡張枠、退会（Danger Zone）を表示する。
 */
export function SettingsView({ displayName, iconUrl }: SettingsViewProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  async function handleDeleteAccount() {
    const ok = window.confirm(t("deleteConfirm"));
    if (!ok) return;

    const res = await fetch("/api/me", { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body?.message ?? t("deleteFailed"));
      return;
    }
    window.location.replace(`/${locale}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">{t("title")}</h1>

      {/* 現在のユーザー情報 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">{t("currentAccount")}</h2>
        <div className="flex items-center gap-4">
          <Avatar src={iconUrl} size="md" />
          <span className="font-medium text-zinc-900">{displayName ?? tCommon("user")}</span>
        </div>
      </section>

      {/* 将来の拡張枠（ダミー） */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">{t("privacySettings")}</h2>
        <p className="text-sm text-zinc-400">{t("comingSoon")}</p>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">{t("notificationSettings")}</h2>
        <p className="text-sm text-zinc-400">{t("comingSoon")}</p>
      </section>

      {/* 法務情報 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">{tCommon("legal")}</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/terms?from=settings" className="text-zinc-700 underline hover:text-zinc-900">
              {tCommon("terms")}
            </Link>
          </li>
          <li>
            <Link href="/privacy?from=settings" className="text-zinc-700 underline hover:text-zinc-900">
              {tCommon("privacy")}
            </Link>
          </li>
        </ul>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-red-800">{t("dangerZone")}</h2>
        <p className="mb-4 text-sm text-red-700">{t("dangerZoneDesc")}</p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {t("deleteAccountButton")}
        </button>
      </section>
    </div>
  );
}
