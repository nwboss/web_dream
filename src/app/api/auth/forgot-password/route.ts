import { NextResponse } from "next/server";

import { isValidEmail } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim() || "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, message: "请输入有效邮箱。" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "找回流程占位成功。后续会接入真实邮件或验证码服务。"
  });
}
