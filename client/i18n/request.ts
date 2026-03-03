import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  
  const locale = (requested && routing.locales.includes(requested as any))
    ? (requested as string)
    : routing.defaultLocale;

  // サーバー環境で安全に動的インポート
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});