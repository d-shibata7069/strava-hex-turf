import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { JoinGroupView } from "@/components/organisms";

/**
 * 招待コードでグループに参加するページ。未ログインの場合は /login へリダイレクト。
 */
export default async function JoinPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }

  return <JoinGroupView />;
}
