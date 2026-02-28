import { getSessionUserId } from "@/lib/session";
import { LandingPage } from "./components/LandingPage";
import { Map } from "./components/Map";

export default async function HomePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    return <LandingPage />;
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-gray-50">
      <div className="flex-1 relative min-h-[calc(100vh-3.5rem)]">
        <Map />
      </div>
    </main>
  );
}
