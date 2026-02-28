import Link from "next/link";

export interface LoginViewProps {
  /** Strava 認可画面への URL（Storybook ではモック URL を渡す） */
  authUrl: string;
}

/**
 * ログイン画面のプレゼンテーション。
 * ページは authUrl を組み立てて渡し、Storybook ではモック URL で表示する。
 */
export function LoginView({ authUrl }: LoginViewProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
          Strava陣取り
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Stravaと連携してログインしてください
        </p>
        <Link
          href={authUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          data-testid="connect-strava"
        >
          <span>Connect with Strava</span>
        </Link>
      </div>
    </main>
  );
}
