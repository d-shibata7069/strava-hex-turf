"use client";

import { StravaConnectButton } from "@/components/atoms";
import { ArrowRightIcon } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * 未ログイン時に表示するランディングページ。
 * プロダクトの世界観（陣取り・奪取・仲間と競う）を伝え、/login へ誘導する。
 */
export function LandingPage() {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  return (
    <div className="font-sans">
      {/* Hero: フルビューポート、ダーク、六角形モチーフ */}
      <section
        className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 py-20"
        aria-label={t("mainAria")}
      >
        <div
          className="absolute inset-0 bg-zinc-950"
          style={{
            backgroundImage: `
              linear-gradient(180deg, rgba(24,24,27,0.97) 0%, rgba(9,9,11,0.98) 50%, rgb(9,9,11) 100%),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 56 98'%3E%3Cpath fill='none' stroke='%2322c55e' stroke-opacity='0.08' stroke-width='0.6' d='M28 0L56 14v28L28 70 0 56V14L28 0zm0 14L14 21v14l14 7 14-7V21L28 14z'/%3E%3C/svg%3E")
            `,
            backgroundSize: "auto 120px",
            backgroundPosition: "50% 0",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            {t("tagline")}
          </p>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            {t("headline")}
            <span className="block text-emerald-400">{t("headlineHighlight")}</span>
          </h1>
          <p className="mb-10 max-w-xl mx-auto text-lg text-zinc-400 leading-relaxed">
            {t("subhead")}
          </p>
          <StravaConnectButton
            href="/login"
            variant="default"
            className="focus:ring-offset-zinc-950"
            rightIcon={<ArrowRightIcon className="h-5 w-5" />}
          >
            {t("cta")}
          </StravaConnectButton>
        </div>
      </section>

      {/* 特徴: 3 本柱 */}
      <section
        className="relative border-t border-zinc-800/80 bg-zinc-900/50 px-4 py-16 sm:py-24"
        aria-label={t("featuresAria")}
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-white sm:text-3xl">
            {t("featuresTitle")}
          </h2>
          <ul className="grid gap-10 sm:grid-cols-3">
            <li className="flex flex-col items-center text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400" aria-hidden>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </span>
              <h3 className="mb-2 font-semibold text-white">{t("feature1Title")}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {t("feature1Desc")}
              </p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400" aria-hidden>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h3 className="mb-2 font-semibold text-white">{t("feature2Title")}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {t("feature2Desc")}
              </p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400" aria-hidden>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
              <h3 className="mb-2 font-semibold text-white">{t("feature3Title")}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {t("feature3Desc")}
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* 最終 CTA */}
      <section
        className="border-t border-zinc-800/80 bg-zinc-950 px-4 py-16 sm:py-20"
        aria-label={t("startAria")}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
            {t("finalCtaTitle")}
          </h2>
          <p className="mb-8 text-zinc-400">
            {t("finalCtaDesc")}
          </p>
          <StravaConnectButton
            href="/login"
            variant="default"
            className="focus:ring-offset-zinc-950"
            rightIcon={<ArrowRightIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* フッター: 法務リンク */}
      <footer
        className="border-t border-zinc-800/80 bg-zinc-950 px-4 py-6"
        aria-label={t("footerAria")}
      >
        <div className="mx-auto flex max-w-5xl justify-center gap-6 text-center text-sm text-zinc-500">
          <Link href="/terms" className="hover:text-zinc-300">
            {tCommon("terms")}
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300">
            {tCommon("privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
