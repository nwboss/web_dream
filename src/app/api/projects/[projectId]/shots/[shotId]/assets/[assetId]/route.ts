import { readFile } from "fs/promises";

import { NextResponse } from "next/server";

import { getShotAsset } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

type Context = {
  params: Promise<{
    projectId: string;
    shotId: string;
    assetId: string;
  }>;
};

function getContentTypeFromPath(filePath: string) {
  if (filePath.endsWith(".png")) {
    return "image/png";
  }

  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }

  if (filePath.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}

export async function GET(_request: Request, context: Context) {
  const session = await requireSession();
  const { projectId, shotId, assetId } = await context.params;
  const result = await getShotAsset(session.email, projectId, shotId, assetId);

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
