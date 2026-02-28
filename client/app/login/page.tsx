import Link from "next/link";

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
