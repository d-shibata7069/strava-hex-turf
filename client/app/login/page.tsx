import { LoginView } from "@/components/LoginView";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";

function buildStravaAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/auth/strava/callback`;
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

export default function LoginPage() {
  const authUrl = buildStravaAuthUrl();
  return <LoginView authUrl={authUrl} />;
}
