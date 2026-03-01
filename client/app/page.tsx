import { getSessionUserId } from "@/lib/session";
import { LandingPage, Map } from "@/components/organisms";

export default async function HomePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    return <LandingPage />;
  }

  return (
    <main className="relative bg-gray-50">
      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        <Map />
      </div>
    </main>
  );
}
