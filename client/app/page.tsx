import Link from "next/link";
import { Map } from "./components/Map";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col bg-gray-50">
      <div className="flex-1 relative min-h-[calc(100vh-4rem)]">
        <Map />
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Link
          href="/login"
          className="rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-orange-600 shadow hover:bg-white hover:text-orange-700"
        >
          ログイン
        </Link>
      </div>
    </main>
  );
}
