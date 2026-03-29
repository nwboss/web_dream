import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { generateStandaloneVideo } from "@/lib/studio-store";

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json()) as { prompt?: string };
  const prompt = body.prompt?.trim() || "";

  const result = await generateStandaloneVideo(session.email, prompt || "独立视频生成");
  return NextResponse.json({ ok: true, job: result.job, asset: result.asset });
}
