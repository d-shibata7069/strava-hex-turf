import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getSessionDestroyOptions,
} from "@/lib/session";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseRedirect = appUrl.replace(/\/$/, "") || "http://localhost:3000";

  const response = NextResponse.redirect(baseRedirect);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    getSessionDestroyOptions()
  );
  return response;
}
