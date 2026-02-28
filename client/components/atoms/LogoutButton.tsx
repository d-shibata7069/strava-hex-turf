/**
 * ログアウト用のリンク（/api/auth/logout への a タグ）。
 */
export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <a
      href="/api/auth/logout"
      className={
        `rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${className}`.trim()
      }
    >
      ログアウト
    </a>
  );
}
