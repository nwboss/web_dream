import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { generateJimengImage, isJimengRealImageEnabled } from "@/lib/jimeng-provider";

export type ShotStatus = "draft" | "ready" | "generating" | "done";

export type Shot = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  status: ShotStatus;
  aspectRatio: "9:16" | "16:9" | "1:1";
  updatedAt: string;
  jobs: Job[];
  assets: Asset[];
};

export type JobKind = "image" | "video";
export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

export type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  message: string;
  name?: string;
};

export type Asset = {
  id: string;
  kind: JobKind;
  title: string;
  prompt: string;
  previewUrl: string;
  createdAt: string;
  durationSec?: number;
  source: "mock" | "jimeng";
  storagePath?: string;
  originalUrl?: string;
};

export type Scene = {
  id: string;
  title: string;
  sortOrder: number;
  shots: Shot[];
};

export type Project = {
  id: string;
  ownerEmail: string;
  title: string;
  premise: string;
  genre: string;
  updatedAt: string;
  scenes: Scene[];
};

type ProjectDraft = {
  title: string;
  premise: string;
  genre: string;
};

type ShotPatch = Partial<Pick<Shot, "title" | "description" | "prompt" | "status" | "aspectRatio">>;
type ProjectStore = Record<string, Project[]>;

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "projects.json");
const assetsDir = path.join(dataDir, "assets");

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => ({
        ...shot,
        jobs: shot.jobs.map((job) => ({ ...job })),
        assets: shot.assets.map((asset) => ({ ...asset }))
      }))
    }))
  };
}

function createMockPreview(kind: JobKind, title: string, accent: string) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const subtitle = kind === "image" ? "Mock Image" : "Mock Video";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="960" height="540" rx="32" fill="url(#g)" />
      <circle cx="760" cy="120" r="90" fill="rgba(255,255,255,0.12)" />
      <circle cx="180" cy="390" r="120" fill="rgba(255,255,255,0.08)" />
      <text x="72" y="138" fill="#ffd166" font-size="28" font-family="Arial, sans-serif">${subtitle}</text>
      <text x="72" y="250" fill="#f8fafc" font-size="48" font-family="Arial, sans-serif">${safeTitle}</text>
      <text x="72" y="310" fill="#cbd5e1" font-size="24" font-family="Arial, sans-serif">即梦 MVP 生成结果占位</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeShot(shot: Shot): Shot {
  return {
    ...shot,
    jobs: Array.isArray(shot.jobs) ? shot.jobs.map((job) => ({ ...job })) : [],
    assets: Array.isArray(shot.assets) ? shot.assets.map((asset) => ({ ...asset })) : []
  };
}

function cloneAsset(asset: Asset): Asset {
  return { ...asset };
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

  return {
    storagePath: storageFile
  };
}

function createSeedProjects(ownerEmail: string): Project[] {
  const shot1: Shot = {
    id: createId("shot"),
    title: "天台对峙",
    description: "少年在风雨中的天台边缘停下脚步，第一次直面命运。",
    prompt: "黑发少年站在暴雨夜天台边缘，城市霓虹，电影感国漫，中景，压迫感",
    status: "draft",
    aspectRatio: "9:16",
    updatedAt: now(),
    jobs: [],
    assets: []
  };

  const shot2: Shot = {
    id: createId("shot"),
    title: "回头一瞬",
    description: "女主在楼梯口回头，看见少年消失在雨幕中。",
    prompt: "短发少女回头，楼梯口冷光，细腻笔触，情绪拉满，近景",
    status: "ready",
    aspectRatio: "9:16",
    updatedAt: now(),
    jobs: [],
    assets: []
  };

  const shot3: Shot = {
    id: createId("shot"),
    title: "旧巷初遇",
    description: "旧巷积水倒映霓虹，两人第一次正面相遇。",
    prompt: "旧巷霓虹反光，两位高中生对视，氛围感国漫，广角构图",
    status: "done",
    aspectRatio: "16:9",
    updatedAt: now(),
    jobs: [],
    assets: []
  };

  return [
    {
      id: createId("project"),
      ownerEmail,
      title: "逆光重启",
      premise: "一个被误解的高中生，在一次意外后看见了改变命运的缝隙。",
      genre: "都市校园 / 悬念",
      updatedAt: now(),
      scenes: [
        {
          id: createId("scene"),
          title: "Scene 01 开场坠点",
          sortOrder: 1,
          shots: [shot1, shot2]
        },
        {
          id: createId("scene"),
          title: "Scene 02 命运交汇",
          sortOrder: 2,
          shots: [shot3]
        }
      ]
    }
  ];
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    const content = await readFile(storePath, "utf8");
    const parsed = JSON.parse(content) as ProjectStore;
    return Object.fromEntries(
      Object.entries(parsed).map(([ownerEmail, projects]) => [
        ownerEmail,
        projects.map((project) => ({
          ...project,
          scenes: project.scenes.map((scene) => ({
            ...scene,
            shots: scene.shots.map((shot) => normalizeShot(shot))
          }))
        }))
      ])
    );
  } catch {
    const emptyStore: ProjectStore = {};
    await writeFile(storePath, JSON.stringify(emptyStore, null, 2), "utf8");
    return emptyStore;
  }
}

async function saveStore(store: ProjectStore) {
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

type ShotContext = {
  store: ProjectStore;
  projects: Project[];
  project: Project;
  scene: Scene;
  shot: Shot;
};

async function withShotContext(ownerEmail: string, projectId: string, shotId: string) {
  const store = await ensureStore();

  if (!store[ownerEmail]) {
    store[ownerEmail] = createSeedProjects(ownerEmail);
    await saveStore(store);
  }

  const projects = store[ownerEmail];
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  for (const scene of project.scenes) {
    const shot = scene.shots.find((item) => item.id === shotId);
    if (shot) {
      return {
        store,
        projects,
        project,
        scene,
        shot
      } satisfies ShotContext;
    }
  }

  return null;
}

async function saveShotContext(context: ShotContext, touchedAt: string) {
  context.shot.updatedAt = touchedAt;
  context.project.updatedAt = touchedAt;
  await saveStore(context.store);
}

export async function listProjects(ownerEmail: string) {
  const store = await ensureStore();

  if (!store[ownerEmail]) {
    store[ownerEmail] = createSeedProjects(ownerEmail);
    await saveStore(store);
  }

  return (store[ownerEmail] || []).map(cloneProject);
}

export async function getProject(ownerEmail: string, projectId: string) {
  const projects = await listProjects(ownerEmail);
  return projects.find((project) => project.id === projectId) || null;
}

export async function createProject(ownerEmail: string, draft: ProjectDraft) {
  const store = await ensureStore();
  const existing = await listProjects(ownerEmail);
  const project: Project = {
    id: createId("project"),
    ownerEmail,
    title: draft.title,
    premise: draft.premise,
    genre: draft.genre,
    updatedAt: now(),
    scenes: [
      {
        id: createId("scene"),
        title: "Scene 01 开场",
        sortOrder: 1,
        shots: [
          {
            id: createId("shot"),
            title: "Shot 01 设定镜头",
            description: "在这里写下这个分镜的画面、角色和情绪。",
            prompt: "",
            status: "draft",
            aspectRatio: "9:16",
            updatedAt: now(),
            jobs: [],
            assets: []
          }
        ]
      }
    ]
  };

  store[ownerEmail] = [project, ...existing].map(cloneProject);
  await saveStore(store);
  return cloneProject(project);
}

export async function addScene(ownerEmail: string, projectId: string) {
  const store = await ensureStore();
  const projects = await listProjects(ownerEmail);
  const target = projects.find((project) => project.id === projectId);
  if (!target) {
    return null;
  }

  const nextSceneNo = target.scenes.length + 1;
  const scene: Scene = {
    id: createId("scene"),
    title: `Scene ${String(nextSceneNo).padStart(2, "0")} 新场次`,
    sortOrder: nextSceneNo,
    shots: []
  };

  target.scenes.push(scene);
  target.updatedAt = now();
  store[ownerEmail] = projects.map(cloneProject);
  await saveStore(store);
  return { project: cloneProject(target), scene: { ...scene, shots: [] } };
}

export async function addShot(ownerEmail: string, projectId: string, sceneId: string) {
  const store = await ensureStore();
  const projects = await listProjects(ownerEmail);
  const target = projects.find((project) => project.id === projectId);
  const scene = target?.scenes.find((item) => item.id === sceneId);
  if (!target || !scene) {
    return null;
  }

  const nextShotNo = scene.shots.length + 1;
  const shot: Shot = {
    id: createId("shot"),
    title: `Shot ${String(nextShotNo).padStart(2, "0")} 新分镜`,
    description: "补充角色、环境、镜头和动作描述。",
    prompt: "",
    status: "draft",
    aspectRatio: "9:16",
    updatedAt: now(),
    jobs: [],
    assets: []
  };

  scene.shots.push(shot);
  target.updatedAt = now();
  store[ownerEmail] = projects.map(cloneProject);
  await saveStore(store);
  return { project: cloneProject(target), scene: cloneProject(target).scenes.find((item) => item.id === sceneId)!, shot: { ...shot } };
}

export async function updateShot(ownerEmail: string, projectId: string, shotId: string, patch: ShotPatch) {
  const store = await ensureStore();
  const projects = await listProjects(ownerEmail);
  const target = projects.find((project) => project.id === projectId);
  if (!target) {
    return null;
  }

  for (const scene of target.scenes) {
    const shot = scene.shots.find((item) => item.id === shotId);
    if (shot) {
      const cleanedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      Object.assign(shot, cleanedPatch, { updatedAt: now() });
      target.updatedAt = now();
      store[ownerEmail] = projects.map(cloneProject);
      await saveStore(store);
      return { project: cloneProject(target), shot: { ...shot } };
    }
  }

  return null;
}

export async function generateShotAsset(ownerEmail: string, projectId: string, shotId: string, kind: JobKind) {
  const context = await withShotContext(ownerEmail, projectId, shotId);
  if (!context) {
    return null;
  }
  const createdAt = now();
  const job: Job = {
    id: createId("job"),
    kind,
    status: "succeeded",
    createdAt,
    message: kind === "image" ? "已完成 1 张候选图生成" : "已完成 1 条视频片段生成"
  };

  const basePrompt = context.shot.prompt || context.shot.description || context.shot.title;
  const asset: Asset = {
    id: createId("asset"),
    kind,
    title: kind === "image" ? `${context.shot.title} 图片版本` : `${context.shot.title} 视频片段`,
    prompt: basePrompt,
    previewUrl: createMockPreview(kind, context.shot.title, kind === "image" ? "#f97316" : "#22c55e"),
    createdAt,
    durationSec: kind === "video" ? 5 : undefined,
    source: "mock"
  };

  context.shot.jobs = [job, ...context.shot.jobs].slice(0, 8);
  context.shot.assets = [asset, ...context.shot.assets];
  context.shot.status = kind === "video" ? "done" : "ready";

  await saveShotContext(context, createdAt);
  return { project: cloneProject(context.project), shot: normalizeShot(context.shot), asset, job };
}

async function processQueuedImageJob(ownerEmail: string, projectId: string, shotId: string, jobId: string) {
  const processingAt = now();
  const processingContext = await withShotContext(ownerEmail, projectId, shotId);
  if (!processingContext) {
    return;
  }

  const processingJob = processingContext.shot.jobs.find((item) => item.id === jobId);
  if (!processingJob) {
    return;
  }

  processingJob.status = "processing";
  processingJob.message = "即梦任务已提交，正在生成图片";
  processingContext.shot.status = "generating";
  await saveShotContext(processingContext, processingAt);

  const shotSnapshot = normalizeShot(processingContext.shot);

  try {
    const providerResult = await generateJimengImage(shotSnapshot);
    const completedAt = now();
    const completedContext = await withShotContext(ownerEmail, projectId, shotId);
    if (!completedContext) {
      return;
    }

    const completedJob = completedContext.shot.jobs.find((item) => item.id === jobId);
    if (!completedJob) {
      return;
    }

    if (!providerResult.ok || !providerResult.imageUrl) {
      completedJob.status = "failed";
      completedJob.message = providerResult.providerMessage;
      completedContext.shot.status = "ready";
      await saveShotContext(completedContext, completedAt);
      return;
    }

    const assetId = createId("asset");
    const localImage = await downloadImageToLocal(assetId, providerResult.imageUrl);
    const asset: Asset = {
      id: assetId,
      kind: "image",
      title: `${completedContext.shot.title} 图片版本`,
      prompt: completedContext.shot.prompt || completedContext.shot.description || completedContext.shot.title,
      previewUrl: `/api/projects/${projectId}/shots/${shotId}/assets/${assetId}`,
      createdAt: completedAt,
      source: "jimeng",
      storagePath: localImage.storagePath,
      originalUrl: providerResult.imageUrl
    };

    completedJob.status = "succeeded";
    completedJob.message = "已通过 Jimeng Provider 生成图片并保存到本地";
    completedContext.shot.assets = [asset, ...completedContext.shot.assets].map(cloneAsset);
    completedContext.shot.status = "ready";
    await saveShotContext(completedContext, completedAt);
  } catch (error) {
    const failedAt = now();
    const failedContext = await withShotContext(ownerEmail, projectId, shotId);
    if (!failedContext) {
      return;
    }

    const failedJob = failedContext.shot.jobs.find((item) => item.id === jobId);
    if (!failedJob) {
      return;
    }

    failedJob.status = "failed";
    failedJob.message = error instanceof Error ? error.message : "图片生成失败，请稍后再试";
    failedContext.shot.status = "ready";
    await saveShotContext(failedContext, failedAt);
  }
}

export async function generateImageForShot(ownerEmail: string, projectId: string, shotId: string) {
  if (!isJimengRealImageEnabled()) {
    return generateShotAsset(ownerEmail, projectId, shotId, "image");
  }

  const context = await withShotContext(ownerEmail, projectId, shotId);
  if (!context) {
    return null;
  }

  const createdAt = now();
  const queuedJob: Job = {
    id: createId("job"),
    kind: "image",
    status: "queued",
    createdAt,
    message: "图片生成任务已入队"
  };

  context.shot.jobs = [queuedJob, ...context.shot.jobs].slice(0, 8);
  context.shot.status = "generating";
  await saveShotContext(context, createdAt);

  void processQueuedImageJob(ownerEmail, projectId, shotId, queuedJob.id);

  return { project: cloneProject(context.project), shot: normalizeShot(context.shot), job: queuedJob, asset: null };
}

export async function getShotAsset(ownerEmail: string, projectId: string, shotId: string, assetId: string) {
  const context = await withShotContext(ownerEmail, projectId, shotId);
  if (!context) {
    return null;
  }

  const asset = context.shot.assets.find((item) => item.id === assetId);
  if (!asset?.storagePath) {
    return null;
  }

  return {
    asset: cloneAsset(asset),
    absolutePath: path.join(assetsDir, asset.storagePath)
  };
}

export function getProjectStats(project: Project) {
  const shotCount = project.scenes.reduce((total, scene) => total + scene.shots.length, 0);
  const readyCount = project.scenes.reduce(
    (total, scene) => total + scene.shots.filter((shot) => shot.status === "ready" || shot.status === "done").length,
    0
  );

  return {
    sceneCount: project.scenes.length,
    shotCount,
    readyCount
  };
}
