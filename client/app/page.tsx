import { getSessionUserId } from "@/lib/session";
import { getTilesH3IndexesForUser } from "@/lib/tiles";
import { LandingPage, Map } from "@/components/organisms";

export default async function HomePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    return <LandingPage />;
  }

  const h3Indexes = await getTilesH3IndexesForUser(userId);

  return (
    <main className="relative bg-gray-50">
      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        <Map initialH3Indexes={h3Indexes} />
      </div>
    </main>
  );
}
