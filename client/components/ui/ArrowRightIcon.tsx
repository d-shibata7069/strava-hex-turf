/**
 * 右矢印アイコン（inline SVG）。
 * 外部アイコンライブラリを導入する場合は本ファイルを lucide-react 等のラッパーに差し替える。
 */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}
