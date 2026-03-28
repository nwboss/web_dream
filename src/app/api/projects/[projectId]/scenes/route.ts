import { NextResponse } from "next/server";

import { addScene } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

type Context = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  const session = await requireSession();
  const { projectId } = await context.params;
  const result = await addScene(session.email, projectId);

  if (!result) {
    return NextResponse.json({ ok: false, message: "项目不存在。" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    project: result.project,
    redirectTo: `/projects/${projectId}`
  });
}
