import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <h1 className="text-xl font-semibold text-gray-900">Strava陣取り</h1>
      <Link
        href="/login"
        className="text-sm text-orange-600 underline hover:text-orange-700"
      >
        ログイン
      </Link>
    </main>
  );
}
