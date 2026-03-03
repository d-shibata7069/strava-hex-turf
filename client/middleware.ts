import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // ブラウザのJS読み込みエラーを防ぐための、厳格なマッチャー設定
  matcher: [
    // 1. トップページ
    "/",
    // 2. 言語プレフィックスが付いたパス
    "/(ja|en)/:path*",
    // 3. API、Next.js内部ファイル、静的ファイル(.js, .css, .svg等)を「完全に」除外する
    "/((?!api|_next/static|_next/image|_vercel|favicon.ico|.*\\..*).*)"
  ],
};