/**
 * ログイン画面のストーリー。
 * LoginView.tsx は next/link と TypeScript のため Storybook の webpack で直接扱わず、
 * 同じ見た目のプレビューをここで定義して視覚確認する。
 */
function LoginViewPreview(props) {
  const authUrl = props.authUrl;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
          Strava陣取り
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Stravaと連携してログインしてください
        </p>
        <a
          href={authUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          data-testid="connect-strava"
        >
          <span>Connect with Strava</span>
        </a>
      </div>
    </main>
  );
}

export default {
  component: LoginViewPreview,
  title: "Login/LoginView",
  tags: ["autodocs"],
};

/** モックの認可URLで表示。プレビュー環境で見た目を確認する用 */
export const Default = {
  args: {
    authUrl:
      "https://www.strava.com/oauth/authorize?client_id=12345&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fstrava%2Fcallback&response_type=code&scope=read%2Cactivity%3Aread_all&approval_prompt=auto",
  },
};
