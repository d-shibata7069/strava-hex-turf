import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { ActivityTimeline, LandingPage, Map } from "@/components/organisms";

export default async function HomePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    return <LandingPage />;
  }

  const supabase = getSupabaseServer();
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .limit(1);
  const firstGroupId = memberships?.[0]?.group_id ?? null;

  return (
    <main className="relative bg-gray-50">
      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        <Map />
        <ActivityTimeline groupId={firstGroupId} />
      </div>
    </main>
  );
}
