import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (authenticated) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Всё закрыто паролем, кроме страницы логина, её API и статики. /api/cron
// (появится позже) авторизуется отдельно через CRON_SECRET, а не эту cookie —
// поэтому тоже исключён из проверки.
export const config = {
  matcher: ["/((?!login|api/auth/login|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
