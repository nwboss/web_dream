import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { generateStandaloneImage } from "@/lib/studio-store";

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json()) as {
    prompt?: string;
    aspectRatio?: "9:16" | "16:9" | "1:1";
    title?: string;
  };

  const prompt = body.prompt?.trim() || "";
  if (!prompt) {
    return NextResponse.json({ ok: false, message: "请输入提示词。" }, { status: 400 });
  }

  const result = await generateStandaloneImage(session.email, {
    prompt,
    aspectRatio: body.aspectRatio || "9:16",
    title: body.title?.trim() || "独立图片结果"
  });

  if (!result.asset) {
    return NextResponse.json({ ok: false, message: result.job.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, job: result.job, asset: result.asset });
}
