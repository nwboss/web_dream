import { NextResponse } from "next/server";

import { generateShotAsset } from "@/lib/project-store";
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
  const result = await generateShotAsset(session.email, projectId, shotId, "video");

  if (!result) {
    return NextResponse.json({ ok: false, message: "分镜不存在，无法生成视频。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, asset: result.asset, job: result.job });
}
