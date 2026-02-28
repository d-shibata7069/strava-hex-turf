import Link from "next/link";

export interface LoginViewProps {
  /** Strava 認可画面への URL（Storybook ではモック URL を渡す） */
  authUrl: string;
}

/**
 * ログイン画面（Strava OAuth 認可へ進む専用ページ）。
 * LP はトップで見せるため、ここは認可アクションに特化したミニマルなUI。
 */
export function LoginView({ authUrl }: LoginViewProps) {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          Strava と連携
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600">
          以下のボタンから Strava の認可画面に進み、陣取りで利用する権限を許可してください。
        </p>
        <Link
          href={authUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          data-testid="connect-strava"
        >
          <span>Connect with Strava</span>
        </Link>
        <Link
          href="/"
          className="mt-4 flex w-full items-center justify-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
