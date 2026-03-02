"use client";

import { StravaConnectButton } from "@/components/atoms";
import { Link as IntlLink } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export interface LoginViewProps {
  /** Strava 認可画面への URL（Storybook ではモック URL を渡す） */
  authUrl: string;
  /** コールバックからのエラー表示用（例: error=token_encryption） */
  errorMessage?: string | null;
}

/**
 * ログイン画面（Strava OAuth 認可へ進む専用ページ）。
 * LP はトップで見せるため、ここは認可アクションに特化したミニマルなUI。
 */
export function LoginView({ authUrl, errorMessage }: LoginViewProps) {
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          {t("title")}
        </h1>
        {errorMessage ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <p className="mb-6 text-center text-sm text-zinc-600">
          {t("description")}
        </p>
        <div className="flex flex-col items-stretch">
          <StravaConnectButton
            href={authUrl}
            variant="compact"
            className="w-full justify-center rounded-lg px-4 py-3 text-sm"
          />
        </div>
        <IntlLink
          href="/"
          className="mt-4 flex w-full items-center justify-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          {t("backToTop")}
        </IntlLink>
      </div>
      <footer className="mt-8 flex w-full max-w-sm justify-center gap-4 text-center text-xs text-zinc-400">
        <IntlLink href="/terms" className="hover:text-zinc-600">
          {tCommon("terms")}
        </IntlLink>
        <IntlLink href="/privacy" className="hover:text-zinc-600">
          {tCommon("privacy")}
        </IntlLink>
      </footer>
    </main>
  );
}
