import { readFile } from "fs/promises";

import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { getStudioAsset } from "@/lib/studio-store";

type Context = {
  params: Promise<{
    assetId: string;
  }>;
};

function getContentTypeFromPath(filePath: string) {
  if (filePath.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (filePath.endsWith(".webm")) {
    return "video/webm";
  }

  if (filePath.endsWith(".png")) {
    return "image/png";
  }

  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }

  if (filePath.endsWith(".gif")) {
    return "image/gif";
  }

  if (filePath.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (filePath.endsWith(".wav")) {
    return "audio/wav";
  }

  if (filePath.endsWith(".ogg")) {
    return "audio/ogg";
  }

  return "image/jpeg";
}

export async function GET(_request: Request, context: Context) {
  const session = await requireSession();
  const { assetId } = await context.params;
  const result = await getStudioAsset(session.email, assetId);

  if (!result) {
    return new NextResponse("Asset not found", { status: 404 });
  }

  const fileBuffer = await readFile(result.absolutePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": getContentTypeFromPath(result.absolutePath),
      "Cache-Control": "private, max-age=31536000, immutable"
    }
  });
}
