import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { generateJimengImage, generateJimengVideo, isJimengRealImageEnabled, isJimengRealVideoEnabled } from "@/lib/jimeng-provider";
import type { Asset, Job, JobStatus, Shot } from "@/lib/project-store";

type StudioMode = "image" | "video";

type StudioImageDraft = {
  prompt: string;
  aspectRatio: Shot["aspectRatio"];
  title?: string;
  model?: string;
  stylePreset?: string;
};

export type StudioReferenceImage = {
  id: string;
  title: string;
  previewUrl: string;
  createdAt: string;
  storagePath: string;
};

type StudioStoreRecord = {
  imageJobs: Job[];
  imageAssets: Asset[];
  videoJobs: Job[];
  videoAssets: Asset[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
};

type StudioStore = Record<string, StudioStoreRecord>;

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "studio.json");
const assetsDir = path.join(dataDir, "assets");

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function emptyRecord(): StudioStoreRecord {
  return {
    imageJobs: [],
    imageAssets: [],
    videoJobs: [],
    videoAssets: [],
    referenceImage: null,
    referenceEndImage: null
  };
}

function cloneAsset(asset: Asset): Asset {
  return { ...asset };
}

function cloneJob(job: Job): Job {
  return { ...job };
}

function cloneReferenceImage(referenceImage: StudioReferenceImage | null) {
  return referenceImage ? { ...referenceImage } : null;
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
    store[ownerEmail] = emptyRecord();
  }

  return store[ownerEmail];
}

function inferImageExtension(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes("png")) {
    return ".png";
  }
  if (contentType?.includes("webp")) {
    return ".webp";
  }
  if (contentType?.includes("gif")) {
    return ".gif";
  }

  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    const matched = pathname.match(/\.(png|jpe?g|webp|gif)$/);
    if (matched) {
      return `.${matched[1] === "jpg" ? "jpg" : matched[1]}`;
    }
  } catch {}

  return ".jpg";
}

function inferImageExtensionFromUpload(contentType: string, fileName: string) {
  if (contentType.includes("png")) {
    return ".png";
  }
  if (contentType.includes("webp")) {
    return ".webp";
  }
  if (contentType.includes("gif")) {
    return ".gif";
  }
  if (contentType.includes("jpeg")) {
    return ".jpg";
  }

  const lower = fileName.toLowerCase();
  const matched = lower.match(/\.(png|jpe?g|webp|gif)$/);
  if (matched) {
    return `.${matched[1] === "jpeg" ? "jpg" : matched[1]}`;
  }

  return ".jpg";
}

async function downloadImageToLocal(assetId: string, imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`下载图片失败: HTTP ${response.status}`);
  }

  const extension = inferImageExtension(response.headers.get("content-type"), imageUrl);
  const storageFile = `${assetId}${extension}`;
  const storagePath = path.join(assetsDir, storageFile);
  const fileBuffer = Buffer.from(await response.arrayBuffer());

  await mkdir(assetsDir, { recursive: true });
  await writeFile(storagePath, fileBuffer);

  return storageFile;
}

async function saveBufferToLocal(fileId: string, fileBuffer: Buffer, extension: string) {
  const storageFile = `${fileId}${extension}`;
  const storagePath = path.join(assetsDir, storageFile);

  await mkdir(assetsDir, { recursive: true });
  await writeFile(storagePath, fileBuffer);

  return storageFile;
}

function createMockPreview(kind: StudioMode, title: string, accent: string) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const subtitle = kind === "image" ? "Standalone Image" : "Standalone Video";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#101828" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="960" height="540" rx="32" fill="url(#g)" />
      <text x="72" y="138" fill="#ffd166" font-size="28" font-family="Arial, sans-serif">${subtitle}</text>
      <text x="72" y="250" fill="#f8fafc" font-size="48" font-family="Arial, sans-serif">${safeTitle}</text>
      <text x="72" y="310" fill="#cbd5e1" font-size="24" font-family="Arial, sans-serif">独立创作模块结果</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createShotDraft(draft: StudioImageDraft): Shot {
  return {
    id: createId("shot"),
    title: draft.title?.trim() || "独立图片生成",
    description: draft.prompt,
    prompt: draft.prompt,
    status: "draft",
    aspectRatio: draft.aspectRatio,
    updatedAt: now(),
    jobs: [],
    assets: []
  };
}

export async function getStudioState(ownerEmail: string) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);

  return {
    imageJobs: record.imageJobs.map(cloneJob),
    imageAssets: record.imageAssets.map(cloneAsset),
    videoJobs: record.videoJobs.map(cloneJob),
    videoAssets: record.videoAssets.map(cloneAsset),
    referenceImage: cloneReferenceImage(record.referenceImage),
    referenceEndImage: cloneReferenceImage(record.referenceEndImage)
  };
}

export async function generateStandaloneImage(ownerEmail: string, draft: StudioImageDraft) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const createdAt = now();

  const promptText = [draft.stylePreset, draft.prompt].filter(Boolean).join("，");
  const referenceImageBase64 = record.referenceImage
    ? (await readFile(path.join(assetsDir, record.referenceImage.storagePath))).toString("base64")
    : undefined;

  if (!isJimengRealImageEnabled()) {
    const job: Job = {
      id: createId("job"),
      kind: "image",
      status: "succeeded",
      createdAt,
      message: "已生成独立图片结果（Mock）"
    };

    const asset: Asset = {
      id: createId("asset"),
      kind: "image",
      title: draft.title?.trim() || "独立图片结果",
      prompt: promptText,
      previewUrl: createMockPreview("image", draft.title?.trim() || "独立图片结果", "#f97316"),
      createdAt,
      source: "mock"
    };

    record.imageJobs = [job, ...record.imageJobs].slice(0, 12);
    record.imageAssets = [asset, ...record.imageAssets].slice(0, 24);
    await saveStore(store);
    return { job, asset };
  }

  const job: Job = {
    id: createId("job"),
    kind: "image",
    status: "processing",
    createdAt,
    message: "图片生成中"
  };
  record.imageJobs = [job, ...record.imageJobs].slice(0, 12);
  await saveStore(store);

  try {
    const providerResult = await generateJimengImage(createShotDraft({ ...draft, prompt: promptText }), referenceImageBase64);
    if (!providerResult.ok || !providerResult.imageUrl) {
      job.status = "failed";
      job.message = providerResult.providerMessage;
      await saveStore(store);
      return { job, asset: null };
    }

    const assetId = createId("asset");
    const storagePath = await downloadImageToLocal(assetId, providerResult.imageUrl);
    const asset: Asset = {
      id: assetId,
      kind: "image",
      title: draft.title?.trim() || "独立图片结果",
      prompt: promptText,
      previewUrl: `/api/studio/assets/${assetId}`,
      createdAt: now(),
      source: "jimeng",
      storagePath,
      originalUrl: providerResult.imageUrl
    };

    job.status = "succeeded";
    job.message = "已完成独立图片生成";
    record.imageAssets = [asset, ...record.imageAssets].slice(0, 24);
    await saveStore(store);
    return { job, asset };
  } catch (error) {
    job.status = "failed";
    job.message = error instanceof Error ? error.message : "图片生成失败";
    await saveStore(store);
    return { job, asset: null };
  }
}

async function downloadVideoToLocal(assetId: string, videoUrl: string) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`下载视频失败: HTTP ${response.status}`);
  }

  const extension = ".mp4";
  const storageFile = `${assetId}${extension}`;
  const storagePath = path.join(assetsDir, storageFile);
  const fileBuffer = Buffer.from(await response.arrayBuffer());

  await mkdir(assetsDir, { recursive: true });
  await writeFile(storagePath, fileBuffer);

  return storageFile;
}

async function processVideoGenerationInBackground(
  ownerEmail: string,
  jobId: string,
  prompt: string,
  aspectRatio?: string,
  duration?: number,
  referenceImageBase64?: string,
  referenceEndImageBase64?: string
) {
  try {
    const providerResult = await generateJimengVideo(prompt, referenceImageBase64, referenceEndImageBase64, duration, aspectRatio);

    const store = await ensureStore();
    const record = ensureUserRecord(store, ownerEmail);
    const job = record.videoJobs.find((j) => j.id === jobId);

    if (!job) {
      console.error(`[Video Generation] Job ${jobId} not found`);
      return;
    }

    if (!providerResult.ok || !providerResult.videoUrl) {
      job.status = "failed";
      job.message = providerResult.providerMessage;
      await saveStore(store);
      return;
    }

    const assetId = createId("asset");
    const storagePath = await downloadVideoToLocal(assetId, providerResult.videoUrl);
    const asset: Asset = {
      id: assetId,
      kind: "video",
      title: "独立视频片段",
      prompt,
      previewUrl: `/api/studio/assets/${assetId}`,
      createdAt: now(),
      source: "jimeng",
      storagePath,
      originalUrl: providerResult.videoUrl,
      durationSec: duration || 5
    };

    job.status = "succeeded";
    job.message = "已完成独立视频生成";
    record.videoAssets = [asset, ...record.videoAssets].slice(0, 24);
    await saveStore(store);
  } catch (error) {
    console.error(`[Video Generation] Error for job ${jobId}:`, error);

    const store = await ensureStore();
    const record = ensureUserRecord(store, ownerEmail);
    const job = record.videoJobs.find((j) => j.id === jobId);

    if (job) {
      job.status = "failed";
      job.message = error instanceof Error ? error.message : "视频生成失败";
      await saveStore(store);
    }
  }
}

export async function generateStandaloneVideo(
  ownerEmail: string,
  prompt: string,
  aspectRatio?: string,
  duration?: number
) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const createdAt = now();

  const isRealEnabled = isJimengRealVideoEnabled();

  // 读取参考图
  const referenceImageBase64 = record.referenceImage
    ? (await readFile(path.join(assetsDir, record.referenceImage.storagePath))).toString("base64")
    : undefined;

  const referenceEndImageBase64 = record.referenceEndImage
    ? (await readFile(path.join(assetsDir, record.referenceEndImage.storagePath))).toString("base64")
    : undefined;

  if (!isRealEnabled) {
    const job: Job = {
      id: createId("job"),
      kind: "video",
      status: "succeeded",
      createdAt,
      message: "已生成独立视频结果（Mock）"
    };

    const asset: Asset = {
      id: createId("asset"),
      kind: "video",
      title: "独立视频片段",
      prompt,
      previewUrl: createMockPreview("video", "独立视频片段", "#22c55e"),
      createdAt,
      durationSec: 5,
      source: "mock"
    };

    record.videoJobs = [job, ...record.videoJobs].slice(0, 12);
    record.videoAssets = [asset, ...record.videoAssets].slice(0, 24);
    await saveStore(store);
    return { job, asset };
  }

  const job: Job = {
    id: createId("job"),
    kind: "video",
    status: "processing",
    createdAt,
    message: "视频生成中，预计需要 1-3 分钟"
  };
  record.videoJobs = [job, ...record.videoJobs].slice(0, 12);
  await saveStore(store);

  // 异步执行，不等待结果
  setImmediate(() => {
    processVideoGenerationInBackground(
      ownerEmail,
      job.id,
      prompt,
      aspectRatio,
      duration,
      referenceImageBase64,
      referenceEndImageBase64
    ).catch((error) => {
      console.error("[Video Generation] Background process error:", error);
    });
  });

  return { job, asset: null };
}

export async function getStudioAsset(ownerEmail: string, assetId: string) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const asset = [...record.imageAssets, ...record.videoAssets].find((item) => item.id === assetId);

  if (asset?.storagePath) {
    return {
      asset: cloneAsset(asset),
      absolutePath: path.join(assetsDir, asset.storagePath)
    };
  }

  if (record.referenceImage?.id === assetId) {
    return {
      asset: {
        id: record.referenceImage.id,
        kind: "image" as const,
        title: record.referenceImage.title,
        prompt: "",
        previewUrl: record.referenceImage.previewUrl,
        createdAt: record.referenceImage.createdAt,
        source: "mock" as const,
        storagePath: record.referenceImage.storagePath
      },
      absolutePath: path.join(assetsDir, record.referenceImage.storagePath)
    };
  }

  if (record.referenceEndImage?.id === assetId) {
    return {
      asset: {
        id: record.referenceEndImage.id,
        kind: "image" as const,
        title: record.referenceEndImage.title,
        prompt: "",
        previewUrl: record.referenceEndImage.previewUrl,
        createdAt: record.referenceEndImage.createdAt,
        source: "mock" as const,
        storagePath: record.referenceEndImage.storagePath
      },
      absolutePath: path.join(assetsDir, record.referenceEndImage.storagePath)
    };
  }

  return null;
}

export async function saveReferenceImage(ownerEmail: string, fileName: string, contentType: string, fileBuffer: Buffer) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const referenceId = createId("ref");
  const extension = inferImageExtensionFromUpload(contentType, fileName);
  const storagePath = await saveBufferToLocal(referenceId, fileBuffer, extension);

  const referenceImage: StudioReferenceImage = {
    id: referenceId,
    title: fileName || "参考图",
    previewUrl: `/api/studio/assets/${referenceId}`,
    createdAt: now(),
    storagePath
  };

  record.referenceImage = referenceImage;
  await saveStore(store);

  return cloneReferenceImage(referenceImage);
}

export async function clearReferenceImage(ownerEmail: string) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  record.referenceImage = null;
  await saveStore(store);
}

export async function saveReferenceEndImage(ownerEmail: string, fileName: string, contentType: string, fileBuffer: Buffer) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const referenceId = createId("ref_end");
  const extension = inferImageExtensionFromUpload(contentType, fileName);
  const storagePath = await saveBufferToLocal(referenceId, fileBuffer, extension);

  const referenceEndImage: StudioReferenceImage = {
    id: referenceId,
    title: fileName || "尾帧参考图",
    previewUrl: `/api/studio/assets/${referenceId}`,
    createdAt: now(),
    storagePath
  };

  record.referenceEndImage = referenceEndImage;
  await saveStore(store);

  return cloneReferenceImage(referenceEndImage);
}

export async function clearReferenceEndImage(ownerEmail: string) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  record.referenceEndImage = null;
  await saveStore(store);
}
