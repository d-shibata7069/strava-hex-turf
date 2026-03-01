import { LogOut } from "lucide-react";

/**
 * ログアウト用のリンク（/api/auth/logout への a タグ）。
 * スマホではアイコンのみ表示し、sm以上でアイコン+テキストを表示。
 */
export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <a
      href="/api/auth/logout"
      aria-label="ログアウト"
      className={
        [
          "inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
          "min-h-[44px] min-w-[44px] p-2.5 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5",
          className,
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
      }
    >
      <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="hidden sm:inline">ログアウト</span>
    </a>
  );
}
