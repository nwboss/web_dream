import { NextResponse } from "next/server";

import { generateImageForShot } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

type Context = {
  params: Promise<{
    projectId: string;
    shotId: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  const session = await requireSession();
  const { projectId, shotId } = await context.params;
  const result = await generateImageForShot(session.email, projectId, shotId);

  if (!result) {
    return NextResponse.json({ ok: false, message: "分镜不存在，无法生成图片。" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    queued: result.job.status === "queued" || result.job.status === "processing",
    asset: result.asset,
    job: result.job
  });
}
