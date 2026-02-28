"use client";

import Link from "next/link";

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
  "inline-flex items-center justify-center gap-2 font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2";
const variantClasses = {
  default:
    "rounded-xl bg-orange-500 px-8 py-4 text-base font-semibold shadow-lg shadow-orange-500/25 hover:bg-orange-600 hover:shadow-orange-500/30 focus:ring-offset-zinc-950",
  compact:
    "rounded-lg bg-orange-500 px-4 py-2 text-sm hover:bg-orange-600 focus:ring-offset-2",
};

/**
 * Strava 連携（Connect with Strava）用のリンクボタン。
 */
export function StravaConnectButton({
  href,
  children = "Connect with Strava",
  variant = "compact",
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
      <span>{children}</span>
      {rightIcon}
    </Link>
  );
}
