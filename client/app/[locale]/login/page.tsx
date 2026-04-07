import { LoginView } from "@/components/organisms/LoginView";
import { getTranslations } from "next-intl/server";

const STRAVA_LOGIN_ROUTE = "/api/auth/strava/login";

const LOGIN_ERROR_KEYS: Record<string, string> = {
  denied: "errorDenied",
  no_code: "errorNoCode",
  config: "errorConfig",
  token_exchange: "errorTokenExchange",
  no_athlete: "errorNoAthlete",
  upsert: "errorUpsert",
  token_encryption: "errorTokenEncryption",
  state_mismatch: "errorStateMismatch",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("login");
  const errorMessage =
    error && LOGIN_ERROR_KEYS[error] ? t(LOGIN_ERROR_KEYS[error]) : null;
  return <LoginView authUrl={STRAVA_LOGIN_ROUTE} errorMessage={errorMessage} />;
}
