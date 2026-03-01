import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { CreateGroupView } from "@/components/organisms";

/**
 * グループ新規作成ページ。
 */
export default async function NewGroupPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return <CreateGroupView />;
}
