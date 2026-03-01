import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { JoinGroupView } from "@/components/organisms";

/**
 * 招待コードでグループに参加するページ。未ログインの場合は /login へリダイレクト。
 */
export default async function JoinPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return <JoinGroupView />;
}
