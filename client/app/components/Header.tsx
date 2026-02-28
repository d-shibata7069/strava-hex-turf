import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";

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
        <Link
          href="/"
          className="text-lg font-semibold text-gray-900 no-underline"
        >
          Strava陣取り
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="flex items-center gap-2 text-sm text-gray-700">
                {user.iconUrl ? (
                  <img
                    src={user.iconUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    width={32}
                    height={32}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs text-gray-600">
                    ?
                  </span>
                )}
                <span className="font-medium">{user.displayName ?? "ユーザー"}</span>
              </span>
              <a
                href="/api/auth/logout"
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                ログアウト
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              data-testid="connect-strava"
            >
              Connect with Strava
            </Link>
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
