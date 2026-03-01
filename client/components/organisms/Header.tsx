import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { LogoLink, StravaConnectButton, LogoutButton } from "@/components/atoms";
import { UserProfileBadge } from "@/components/molecules";

export interface HeaderUser {
  displayName: string | null;
  iconUrl: string | null;
}

/**
 * ヘッダーの表示用コンポーネント。Storybook でログイン/未ログインの見た目を確認するために分離。
 */
export function HeaderView({ user }: { user: HeaderUser | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <LogoLink />

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/groups"
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                マイグループ
              </Link>
              <Link
                href="/join"
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                参加
              </Link>
              <Link
                href="/groups/new"
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                作成
              </Link>
              <UserProfileBadge
                displayName={user.displayName}
                iconUrl={user.iconUrl}
              />
              <LogoutButton />
            </>
          ) : (
            <StravaConnectButton href="/login" variant="compact" />
          )}
        </nav>
      </div>
    </header>
  );
}

export async function Header() {
  const userId = await getSessionUserId();
  let user: HeaderUser | null = null;

  if (userId) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("users")
      .select("display_name, icon_url")
      .eq("id", userId)
      .single();
    user = {
      displayName: data?.display_name ?? null,
      iconUrl: data?.icon_url ?? null,
    };
  }

  return <HeaderView user={user} />;
}
