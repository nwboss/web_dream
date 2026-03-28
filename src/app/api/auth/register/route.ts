import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, createSessionToken, isValidEmail } from "@/lib/auth";

function shouldUseSecureCookie(request: Request) {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  return process.env.NODE_ENV === "production" && forwardedProto === "https";
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; name?: string };
  const email = body.email?.trim() || "";
  const password = body.password?.trim() || "";
  const name = body.name?.trim() || "";

  if (!name) {
    return NextResponse.json({ ok: false, message: "请输入昵称。" }, { status: 400 });
  }

  if (!isValidEmail(email) || password.length < 8) {
    return NextResponse.json({ ok: false, message: "请输入有效邮箱和至少 8 位密码。" }, { status: 400 });
  }

  const sessionToken = await createSessionToken({
    email,
    name
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return NextResponse.json({
    ok: true,
    message: "注册成功，欢迎来到即梦漫剧工坊。",
    redirectTo: "/dashboard"
  });
}
