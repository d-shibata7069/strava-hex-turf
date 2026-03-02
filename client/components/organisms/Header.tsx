import { Link } from "@/i18n/navigation";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { LogoLink, StravaConnectButton, LogoutButton } from "@/components/atoms";
import { UserProfileBadge, NotificationBell } from "@/components/molecules";

export interface HeaderUser {
  displayName: string | null;
  iconUrl: string | null;
}

export interface HeaderViewProps {
  user: HeaderUser | null;
  labels: { myGroups: string; accountSettings: string };
}

export function HeaderView({ user, labels }: HeaderViewProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <LogoLink />

        <nav className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              <Link
                href="/groups"
                className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900"
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{labels.myGroups}</span>
              </Link>
              <NotificationBell />
              <Link
                href="/settings"
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                aria-label={labels.accountSettings}
              >
                <UserProfileBadge
                  displayName={user.displayName}
                  iconUrl={user.iconUrl}
                />
              </Link>
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

  const t = await getTranslations("common");
  const labels = { myGroups: t("myGroups"), accountSettings: t("accountSettings") };
  return <HeaderView user={user} labels={labels} />;
}
