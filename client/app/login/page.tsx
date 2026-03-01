import { LoginView } from "@/components/organisms/LoginView";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  denied: "Strava の認可がキャンセルされました。",
  no_code: "認可コードが取得できませんでした。",
  config: "Strava の設定が不足しています。",
  token_exchange: "Strava とのトークン交換に失敗しました。",
  no_athlete: "アスリート情報を取得できませんでした。",
  upsert: "アカウントの登録に失敗しました。",
  token_encryption: "トークンの暗号化に失敗しました。管理者に STRAVA_TOKEN_ENCRYPTION_KEY の設定を確認してください。",
};

function buildStravaAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/strava/callback`;
  const scope = "read,activity:read_all";
  const params = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    approval_prompt: "auto",
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { error } = searchParams;
  const authUrl = buildStravaAuthUrl();
  const errorMessage = error && LOGIN_ERROR_MESSAGES[error] ? LOGIN_ERROR_MESSAGES[error] : null;
  return <LoginView authUrl={authUrl} errorMessage={errorMessage} />;
}
