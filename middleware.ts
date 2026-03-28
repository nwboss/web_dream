import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE, parseSessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const isProtectedPath = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/account");

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const session = await parseSessionToken(request.cookies.get(AUTH_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"]
};
