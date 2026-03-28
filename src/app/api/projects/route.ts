import { NextResponse } from "next/server";

import { createProject, listProjects } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ ok: true, projects: await listProjects(session.email) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json()) as { title?: string; premise?: string; genre?: string };

  const title = body.title?.trim() || "";
  const premise = body.premise?.trim() || "";
  const genre = body.genre?.trim() || "";

  if (!title || !premise || !genre) {
    return NextResponse.json({ ok: false, message: "请完整填写项目标题、题材和故事简介。" }, { status: 400 });
  }

  const project = await createProject(session.email, { title, premise, genre });
  return NextResponse.json({
    ok: true,
    redirectTo: `/projects/${project.id}`
  });
}
