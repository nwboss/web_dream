import { NextResponse } from "next/server";

import { updateShot } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

type Context = {
  params: Promise<{
    projectId: string;
    shotId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  const session = await requireSession();
  const { projectId, shotId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    prompt?: string;
    status?: "draft" | "ready" | "generating" | "done";
    aspectRatio?: "9:16" | "16:9" | "1:1";
  };

  const result = await updateShot(session.email, projectId, shotId, {
    title: body.title?.trim(),
    description: body.description?.trim(),
    prompt: body.prompt?.trim(),
    status: body.status,
    aspectRatio: body.aspectRatio
  });

  if (!result) {
    return NextResponse.json({ ok: false, message: "分镜不存在。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, shot: result.shot });
}
