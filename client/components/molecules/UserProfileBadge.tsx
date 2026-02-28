import { Avatar } from "@/components/atoms";

export interface UserProfileBadgeProps {
  displayName: string | null;
  iconUrl: string | null;
  className?: string;
}

/**
 * ユーザー名とアバターを横並びで表示するバッジ（ヘッダー用）。
 */
export function UserProfileBadge({
  displayName,
  iconUrl,
  className = "",
}: UserProfileBadgeProps) {
  return (
    <span
      className={`flex items-center gap-2 text-sm text-gray-700 ${className}`.trim()}
    >
      <Avatar src={iconUrl} size="md" />
      <span className="font-medium">{displayName ?? "ユーザー"}</span>
    </span>
  );
}
