import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { generateStandaloneVideo } from "@/lib/studio-store";

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json()) as {
    prompt?: string;
    aspectRatio?: string;
    duration?: number;
    model?: string;
    selectedStartImageId?: string | null;
    selectedEndImageId?: string | null;
    referencedFileIds?: string[];
  };

  const prompt = body.prompt?.trim() || "";
  if (!prompt) {
    return NextResponse.json({ ok: false, message: "请输入提示词。" }, { status: 400 });
  }

  const result = await generateStandaloneVideo(
    session.email,
    prompt,
    body.aspectRatio,
    body.duration,
    body.selectedStartImageId,
    body.selectedEndImageId,
    body.model,
    body.referencedFileIds
  );

  // 异步模式：立即返回job状态，不等待asset生成完成
  return NextResponse.json({
    ok: true,
    job: result.job,
    asset: result.asset,
    message: "视频生成任务已提交，请稍候刷新查看结果"
  });
}
