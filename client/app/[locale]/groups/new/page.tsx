import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getSessionUserId } from "@/lib/session";
import { CreateGroupView } from "@/components/organisms";

/**
 * グループ新規作成ページ。
 */
export default async function NewGroupPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }

  return <CreateGroupView />;
}
