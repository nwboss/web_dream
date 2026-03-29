import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { clearReferenceImage, saveReferenceImage } from "@/lib/studio-store";

export async function POST(request: Request) {
  const session = await requireSession();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "请选择参考图。" }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const referenceImage = await saveReferenceImage(session.email, file.name, file.type || "image/jpeg", fileBuffer);

  return NextResponse.json({ ok: true, referenceImage });
}

export async function DELETE() {
  const session = await requireSession();
  await clearReferenceImage(session.email);
  return NextResponse.json({ ok: true });
}
