import Link from "next/link";

export interface LogoLinkProps {
  className?: string;
}

/**
 * サイトロゴ（Strava陣取り）へのリンク。ヘッダー用。
 */
export function LogoLink({ className = "" }: LogoLinkProps) {
  return (
    <Link
      href="/"
      className={`text-lg font-semibold text-gray-900 no-underline ${className}`.trim()}
    >
      Strava陣取り
    </Link>
  );
}
