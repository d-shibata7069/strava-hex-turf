import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proxy-image?url=...
 * 外部画像URL（Strava CDN・Google プロフィール画像等）をサーバー側で取得し、同一オリジンとして返す。
 * ブラウザの map.loadImage() は fetch を使うため CORS でブロックされるため、
 * このプロキシ経由で取得することで CORS を回避する。
 *
 * 許可するURL:
 * - HTTPS かつ Strava 系 CDN（*.cloudfront.net の /pictures/ を含むパス）
 * - HTTPS かつ Google ユーザーコンテンツ（*.googleusercontent.com、プロフィール画像等）
 * リダイレクトも自動追従せず、遷移先を毎回同じ条件で再検証する（最大3ホップ）。
 */
const ALLOWED_ORIGINS: Array<{ hostPattern: RegExp; pathPattern?: RegExp }> = [
  { hostPattern: /^https:\/\/([a-z0-9-]+\.)*cloudfront\.net\//i, pathPattern: /\/pictures\//i },
  { hostPattern: /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com\//i },
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const fullUrl = url.toString();
    return ALLOWED_ORIGINS.some(
      ({ hostPattern, pathPattern }) =>
        hostPattern.test(fullUrl) && (pathPattern == null || pathPattern.test(url.pathname))
    );
  } catch {
    return false;
  }
}

// リダイレクトは自動追従せず、ホップごとに Location を許可URLか再検証する（A-10）。
// 許可ホスト上にリダイレクトを用意して許可外ホストへ到達する SSRF を防ぐ。
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class DisallowedRedirectError extends Error {}
class TooManyRedirectsError extends Error {}

async function fetchWithValidatedRedirects(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; ; hop++) {
    const res = await fetch(currentUrl, {
      headers: {
        "User-Agent": "StravaHexTurf/1.0 (Image Proxy)",
      },
      redirect: "manual",
      next: { revalidate: 3600 },
    });

    if (!REDIRECT_STATUSES.has(res.status)) {
      return res;
    }

    if (hop >= MAX_REDIRECTS) {
      throw new TooManyRedirectsError("リダイレクト回数の上限を超えました");
    }
    const location = res.headers.get("location");
    if (!location) {
      // Location のないリダイレクト応答はそのまま返す（呼び出し側で !ok として扱う）
      return res;
    }
    const nextUrl = new URL(location, currentUrl).toString();
    if (!isAllowedUrl(nextUrl)) {
      throw new DisallowedRedirectError("リダイレクト先が許可されていないURLです");
    }
    currentUrl = nextUrl;
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam || typeof urlParam !== "string") {
    return NextResponse.json(
      { error: "Bad Request", message: "url クエリが必要です" },
      { status: 400 }
    );
  }

  if (!isAllowedUrl(urlParam)) {
    return NextResponse.json(
      { error: "Forbidden", message: "許可されていない画像URLです" },
      { status: 403 }
    );
  }

  try {
    const res = await fetchWithValidatedRedirects(urlParam);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream Error", message: "画像の取得に失敗しました" },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    if (e instanceof DisallowedRedirectError) {
      return NextResponse.json(
        { error: "Forbidden", message: "許可されていない画像URLです" },
        { status: 403 }
      );
    }
    console.error("proxy-image fetch error:", e);
    return NextResponse.json(
      { error: "Internal Server Error", message: "画像の取得に失敗しました" },
      { status: 502 }
    );
  }
}
