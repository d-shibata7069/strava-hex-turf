import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proxy-image?url=...
 * 外部画像URL（Strava CDN等）をサーバー側で取得し、同一オリジンとして返す。
 * ブラウザの map.loadImage() は fetch を使うため CORS でブロックされるため、
 * このプロキシ経由で取得することで CORS を回避する。
 *
 * 許可するURL: HTTPS かつ Strava 系 CDN（*.cloudfront.net の /pictures/ を含むパス）に限定。
 */
const ALLOWED_HOST_PATTERN = /^https:\/\/([a-z0-9-]+\.)*cloudfront\.net\//i;
const ALLOWED_PATH_PATTERN = /\/pictures\//i;

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const fullUrl = url.toString();
    return ALLOWED_HOST_PATTERN.test(fullUrl) && ALLOWED_PATH_PATTERN.test(url.pathname);
  } catch {
    return false;
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
    const res = await fetch(urlParam, {
      headers: {
        "User-Agent": "StravaHexTurf/1.0 (Image Proxy)",
      },
      next: { revalidate: 3600 },
    });

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
    console.error("proxy-image fetch error:", e);
    return NextResponse.json(
      { error: "Internal Server Error", message: "画像の取得に失敗しました" },
      { status: 502 }
    );
  }
}
