import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { clearReferenceEndImage, saveReferenceEndImage } from "@/lib/studio-store";

export async function POST(request: Request) {
  const session = await requireSession();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "请上传图片文件。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const referenceImage = await saveReferenceEndImage(session.email, file.name, file.type, buffer);

  return NextResponse.json({ ok: true, referenceImage });
}

export async function DELETE() {
  const session = await requireSession();
  await clearReferenceEndImage(session.email);
  return NextResponse.json({ ok: true });
}
