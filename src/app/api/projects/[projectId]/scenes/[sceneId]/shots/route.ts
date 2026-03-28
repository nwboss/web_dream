import { NextResponse } from "next/server";

import { addShot } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

type Context = {
  params: Promise<{
    projectId: string;
    sceneId: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  const session = await requireSession();
  const { projectId, sceneId } = await context.params;
  const result = await addShot(session.email, projectId, sceneId);

  if (!result) {
    return NextResponse.json({ ok: false, message: "场次不存在。" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    project: result.project,
    redirectTo: `/projects/${projectId}?shot=${result.shot.id}`
  });
}
