"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * 現在のパスを維持したままロケール（/ja と /en）を切り替えるUI。
 * ヘッダーまたは設定画面に配置する。
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("languageSwitcher");

  const nextLocale = locale === "ja" ? "en" : "ja";

  function handleSwitch() {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 sm:text-sm" aria-hidden>
        {locale === "ja" ? t("ja") : t("en")}
      </span>
      <button
        type="button"
        onClick={handleSwitch}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 sm:text-sm"
        aria-label={t("label")}
        title={t("label")}
      >
        {routing.locales.find((l) => l !== locale) === "en" ? "English" : "日本語"}
      </button>
    </div>
  );
}
