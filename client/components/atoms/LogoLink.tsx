"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export interface LogoLinkProps {
  className?: string;
}

/**
 * サイトロゴ（Strava陣取り）へのリンク。ヘッダー用。
 */
export function LogoLink({ className = "" }: LogoLinkProps) {
  const t = useTranslations("common");
  return (
    <Link
      href="/"
      className={`text-lg font-semibold text-gray-900 no-underline ${className}`.trim()}
    >
      {t("siteName")}
    </Link>
  );
}
