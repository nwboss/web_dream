import { mkdir, readFile, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

import { requireSession } from "@/lib/session";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "studio.json");
const assetsDir = path.join(dataDir, "assets");

type StudioReferenceFile = {
  id: string;
  title: string;
  type: "image" | "video" | "audio";
  previewUrl: string;
  createdAt: string;
  storagePath: string;
};

type StudioStoreRecord = {
  imageJobs: unknown[];
  imageAssets: unknown[];
  videoJobs: unknown[];
  videoAssets: unknown[];
  referenceImage: unknown;
  referenceEndImage: unknown;
  referenceFiles: StudioReferenceFile[];
};

type StudioStore = Record<string, StudioStoreRecord>;

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as StudioStore;
  } catch {
    const initial: StudioStore = {};
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function saveStore(store: StudioStore) {
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function ensureUserRecord(store: StudioStore, ownerEmail: string) {
  if (!store[ownerEmail]) {
    store[ownerEmail] = {
      imageJobs: [],
      imageAssets: [],
      videoJobs: [],
      videoAssets: [],
      referenceImage: null,
      referenceEndImage: null,
      referenceFiles: []
    };
  }
  if (!store[ownerEmail].referenceFiles) {
    store[ownerEmail].referenceFiles = [];
  }
  return store[ownerEmail];
}

function inferFileType(fileName: string): "image" | "video" | "audio" {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return "image";
  }
  if (["mp4", "mov", "avi", "webm"].includes(ext)) {
    return "video";
  }
  return "audio";
}

function inferExtension(contentType: string | null, fileName: string) {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("mp4")) return ".mp4";
  if (contentType?.includes("webm")) return ".webm";
  if (contentType?.includes("mpeg")) return ".mp3";
  if (contentType?.includes("wav")) return ".wav";

  const ext = fileName.toLowerCase().split(".").pop();
  return ext ? `.${ext}` : ".bin";
}

export async function POST(request: Request) {
  const session = await requireSession();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ ok: false, message: "未上传文件。" }, { status: 400 });
  }

  const store = await ensureStore();
  const record = ensureUserRecord(store, session.email);

  const fileType = inferFileType(file.name);

  // 限制数量
  const imageCount = record.referenceFiles.filter(f => f.type === "image").length;
  const videoCount = record.referenceFiles.filter(f => f.type === "video").length;
  const audioCount = record.referenceFiles.filter(f => f.type === "audio").length;

  if (fileType === "image" && imageCount >= 9) {
    return NextResponse.json({ ok: false, message: "最多只能上传9张参考图片。" }, { status: 400 });
  }
  if (fileType === "video" && videoCount >= 3) {
    return NextResponse.json({ ok: false, message: "最多只能上传3个参考视频。" }, { status: 400 });
  }
  if (fileType === "audio" && audioCount >= 3) {
    return NextResponse.json({ ok: false, message: "最多只能上传3个参考音频。" }, { status: 400 });
  }

  const refId = createId("ref");
  const extension = inferExtension(file.type, file.name);
  const storageFile = `${refId}${extension}`;
  const storagePath = path.join(assetsDir, storageFile);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await mkdir(assetsDir, { recursive: true });
  await writeFile(storagePath, fileBuffer);

  const referenceFile: StudioReferenceFile = {
    id: refId,
    title: file.name,
    type: fileType,
    previewUrl: `/api/studio/assets/${refId}`,
    createdAt: now(),
    storagePath: storageFile
  };

  record.referenceFiles.push(referenceFile);
  await saveStore(store);

  return NextResponse.json({ ok: true, referenceFile });
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  const { orderedIds } = (await request.json()) as { orderedIds?: string[] };

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ ok: false, message: "orderedIds 必须是数组" }, { status: 400 });
  }

  const store = await ensureStore();
  const record = ensureUserRecord(store, session.email);

  const idSet = new Set(orderedIds);
  const orderedFiles = orderedIds
    .map(id => record.referenceFiles.find(f => f.id === id))
    .filter((f): f is StudioReferenceFile => Boolean(f));
  const remainingFiles = record.referenceFiles.filter(f => !idSet.has(f.id));

  record.referenceFiles = [...orderedFiles, ...remainingFiles];
  await saveStore(store);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return NextResponse.json({ ok: false, message: "未指定文件ID。" }, { status: 400 });
  }

  const store = await ensureStore();
  const record = ensureUserRecord(store, session.email);

  record.referenceFiles = record.referenceFiles.filter(f => f.id !== fileId);
  await saveStore(store);

  return NextResponse.json({ ok: true });
}
