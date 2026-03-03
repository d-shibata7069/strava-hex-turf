import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  
  const locale = (requested && routing.locales.includes(requested as any))
    ? (requested as string)
    : routing.defaultLocale;

  // 変数を含めずに直接文字列でインポートする
  let messages;
  if (locale === "en") {
    messages = (await import("../messages/en.json")).default;
  } else {
    messages = (await import("../messages/ja.json")).default;
  }

  return {
    locale,
    messages,
  };
});