import { existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { ensureStore, saveStore } from "@/lib/studio-store";
import { requireSession } from "@/lib/session";
import type { JobKind, Shot } from "@/lib/project-store";
import type { GenerationContext } from "@/lib/studio-store";

const assetsDir = path.join(process.cwd(), "data", "assets");

type PendingRestore = {
  kind: JobKind;
  prompt: string;
  aspectRatio?: Shot["aspectRatio"];
  duration?: number;
  model?: string;
  selectedStartImageId?: string | null;
  selectedEndImageId?: string | null;
};

export async function POST(request: Request) {
  const session = await requireSession();
  const { assetId } = (await request.json()) as { assetId?: string };

  if (!assetId) {
    return NextResponse.json({ ok: false, message: "缺少 assetId" }, { status: 400 });
  }

  const store = await ensureStore();
  const record = store[session.email];

  if (!record) {
    return NextResponse.json({ ok: false, message: "未找到用户记录" }, { status: 404 });
  }

  const allAssets = [...record.imageAssets, ...record.videoAssets];
  const asset = allAssets.find(a => a.id === assetId);

  if (!asset) {
    return NextResponse.json({ ok: false, message: "未找到该生成记录" }, { status: 404 });
  }

  const kind = asset.kind;
  let missingReferences = false;
  const context = asset.generationContext;

  if (context) {
    if (context.referenceImage?.storagePath) {
      if (existsSync(path.join(assetsDir, context.referenceImage.storagePath))) {
        record.referenceImage = {
          ...context.referenceImage,
          createdAt: new Date().toISOString()
        };
      } else {
        record.referenceImage = null;
        missingReferences = true;
      }
    } else {
      record.referenceImage = null;
    }

    if (context.kind === "video") {
      const videoContext = context;

      if (videoContext.referenceEndImage?.storagePath) {
        if (existsSync(path.join(assetsDir, videoContext.referenceEndImage.storagePath))) {
          record.referenceEndImage = {
            ...videoContext.referenceEndImage,
            createdAt: new Date().toISOString()
          };
        } else {
          record.referenceEndImage = null;
          missingReferences = true;
        }
      } else {
        record.referenceEndImage = null;
      }

      if (videoContext.referenceFiles && videoContext.referenceFiles.length > 0) {
        const restoredFiles = [];
        for (const file of videoContext.referenceFiles) {
          if (existsSync(path.join(assetsDir, file.storagePath))) {
            restoredFiles.push({
              ...file,
              createdAt: new Date().toISOString()
            });
          } else {
            missingReferences = true;
          }
        }
        record.referenceFiles = restoredFiles;
      } else {
        record.referenceFiles = [];
      }
    }
  } else {
    record.referenceImage = null;
    record.referenceEndImage = null;
    record.referenceFiles = [];
  }

  const pendingRestore: PendingRestore = {
    kind,
    prompt: asset.prompt,
    aspectRatio: context?.aspectRatio as Shot["aspectRatio"] | undefined,
    duration: context?.kind === "video" ? context.duration : undefined,
    model: context?.model
  };

  if (context?.kind === "video") {
    const videoContext = context;
    if (videoContext.selectedStartImageId) {
      const stillExists = record.imageAssets.some(a => a.id === videoContext.selectedStartImageId);
      if (stillExists) {
        pendingRestore.selectedStartImageId = videoContext.selectedStartImageId;
      } else {
        missingReferences = true;
      }
    }
    if (videoContext.selectedEndImageId) {
      const stillExists = record.imageAssets.some(a => a.id === videoContext.selectedEndImageId);
      if (stillExists) {
        pendingRestore.selectedEndImageId = videoContext.selectedEndImageId;
      } else {
        missingReferences = true;
      }
    }
  }

  record.pendingRestore = pendingRestore;

  await saveStore(store);

  return NextResponse.json({ ok: true, kind, missingReferences });
}
