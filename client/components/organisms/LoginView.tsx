import Link from "next/link";
import { StravaConnectButton } from "@/components/atoms";

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
        <div className="flex flex-col items-stretch">
          <StravaConnectButton
            href={authUrl}
            variant="compact"
            className="w-full justify-center rounded-lg px-4 py-3 text-sm"
          />
        </div>
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
