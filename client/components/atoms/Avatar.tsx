/**
 * アバター画像。URL がない場合はプレースホルダーを表示する。
 */
export interface AvatarProps {
  /** 画像 URL。null の場合は "?" のフォールバック表示 */
  src: string | null;
  /** 代替テキスト（img の alt には空を渡し、アクセシビリティは別要素で対応する想定） */
  alt?: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-xs",
} as const;

export function Avatar({ src, alt = "", size = "md", className = "" }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  if (src) {
    const px = size === "sm" ? 24 : 32;
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ${sizeClass} ${className}`.trim()}
        width={px}
        height={px}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-gray-300 text-gray-600 ${sizeClass} ${className}`.trim()}
      aria-hidden
    >
      ?
    </span>
  );
}
