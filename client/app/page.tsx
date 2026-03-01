import { getSessionUserId } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase";
import { GroupMapView, LandingPage } from "@/components/organisms";

export default async function HomePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    return <LandingPage />;
  }

  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from("group_members")
    .select("group_id, groups(name)")
    .eq("user_id", userId);

  const memberships = (rows ?? []).map((r) => {
    const g = r.groups as { name?: string } | null;
    return {
      group_id: r.group_id,
      group_name: g?.name ?? null,
    };
  });

  return (
    <main className="relative bg-gray-50">
      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        <GroupMapView memberships={memberships} />
      </div>
    </main>
  );
}
