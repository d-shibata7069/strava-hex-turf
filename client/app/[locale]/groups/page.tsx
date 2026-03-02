import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { MyGroupsView } from "@/components/organisms";

/**
 * 参加中のグループ一覧。退会・削除もここから実行する。
 */
export default async function GroupsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }

  return <MyGroupsView />;
}
