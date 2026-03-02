"use client";

import Link from "next/link";

/** Strava公式ロゴアイコン（白・オレンジ背景用） */
function StravaLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

export interface StravaConnectButtonProps {
  href: string;
  children?: React.ReactNode;
  /** ボタンの見た目をフル用（ランディング）かコンパクト用（ヘッダー等）か */
  variant?: "default" | "compact";
  /** 右側に表示するアイコン（例: ArrowRightIcon） */
  rightIcon?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

const baseClass =
  "inline-flex items-center justify-center font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-[#fc4c02] focus:ring-offset-2";

const variantClasses = {
  default:
    "gap-3 rounded-lg bg-[#fc4c02] py-3 px-6 text-base shadow-md hover:bg-[#e34402] focus:ring-offset-zinc-950",
  compact:
    "gap-2 rounded-md bg-[#fc4c02] py-2 px-4 text-sm shadow-md hover:bg-[#e34402] focus:ring-offset-2",
};

/**
 * Strava 連携（Connect with Strava）用のリンクボタン。
 * Strava API ブランドガイドラインに準拠したデザイン。
 */
export function StravaConnectButton({
  href,
  children = "Connect with Strava",
  variant = "default",
  rightIcon,
  className = "",
  "data-testid": dataTestId,
}: StravaConnectButtonProps) {
  return (
    <Link
      href={href}
      className={`${baseClass} ${variantClasses[variant]} ${className}`.trim()}
      data-testid={dataTestId ?? "connect-strava"}
    >
      <StravaLogoIcon className="h-5 w-5 shrink-0" />
      <span>{children}</span>
      {rightIcon}
    </Link>
  );
}
