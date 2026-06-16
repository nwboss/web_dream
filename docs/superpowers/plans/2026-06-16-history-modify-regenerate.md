# 历史记录“修改重跑”实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/history` 页面为每个生成结果增加“修改重跑”按钮，点击后把提示词、生成参数和参考资源恢复到对应工坊并生成新记录；同时优化上传图片的原名显示、多模态参考文件拖拽排序，以及历史页和工坊界面的紧凑排版。

**Architecture:** 在 `Asset` 上新增 `generationContext` 字段保存生成快照；新增 `POST /api/history/restore` 读取快照并恢复参考资源到 `studio.json`，再通过 `pendingRestore` 跨页面传递到工坊；工坊组件读取 `pendingRestore` 回填表单。多模态文件拖拽排序通过原生 HTML5 DnD + `PATCH /api/studio/reference-files` 持久化。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, 文件系统 JSON 存储 (`data/studio.json`)。

---

## 文件结构

| 文件 | 用途 |
|------|------|
| `src/lib/project-store.ts` | 扩展 `Asset` 类型，增加 `generationContext?: GenerationContext` |
| `src/lib/studio-store.ts` | 定义 `GenerationContext` 类型；生成时保存上下文；新增 `takePendingRestore` 辅助函数；扩展 `StudioStoreRecord` 增加 `pendingRestore` |
| `src/app/api/history/restore/route.ts` | 新增恢复 API：根据 `assetId` 恢复参考资源并写入 `pendingRestore` |
| `src/app/api/studio/reference-files/route.ts` | 新增 `PATCH` 方法，支持按 `orderedIds` 重排 `referenceFiles` |
| `src/app/history/page.tsx` | 资源卡片加“修改重跑”按钮；整体紧凑排版 |
| `src/components/history-asset-card.tsx` | 新增 Client Component，封装历史资源卡片和重跑按钮 |
| `src/app/studio/images/page.tsx` | 读取并清空 `pendingRestore`，传给 `StandaloneImageStudio` |
| `src/app/studio/videos/page.tsx` | 读取并清空 `pendingRestore`，传给 `StandaloneVideoStudio` |
| `src/components/standalone-image-studio.tsx` | 回填 `pendingRestore`、显示参考图原名、紧凑排版 |
| `src/components/standalone-video-studio.tsx` | 回填 `pendingRestore`、显示参考图/文件原名、多模态文件拖拽排序、紧凑排版 |

---

## Task 1: 扩展数据模型

**Files:**
- Modify: `src/lib/project-store.ts`
- Modify: `src/lib/studio-store.ts`

**Goal:** 让 `Asset` 能存生成快照，`StudioStoreRecord` 能存待恢复状态，并导出相关类型。

- [ ] **Step 1: 在 `src/lib/project-store.ts` 的 `Asset` 类型中新增 `generationContext`**

修改前：
```ts
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
```

修改后：
```ts
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
  generationContext?: GenerationContext;
};
```

- [ ] **Step 2: 在 `src/lib/studio-store.ts` 中定义 `GenerationContext` 类型并扩展 `StudioStoreRecord`**

在文件顶部（`type StudioMode = "image" | "video";` 之后）新增：

```ts
export type ReferenceImageSnapshot = {
  id: string;
  title: string;
  previewUrl: string;
  storagePath: string;
};

export type ReferenceFileSnapshot = {
  id: string;
  title: string;
  type: "image" | "video" | "audio";
  previewUrl: string;
  storagePath: string;
};

export type ImageGenerationContext = {
  kind: "image";
  prompt: string;
  aspectRatio: Shot["aspectRatio"];
  model?: string;
  referenceImage?: ReferenceImageSnapshot;
};

export type VideoGenerationContext = {
  kind: "video";
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  model?: string;
  referenceImage?: ReferenceImageSnapshot;
  referenceEndImage?: ReferenceImageSnapshot;
  selectedStartImageId?: string | null;
  selectedEndImageId?: string | null;
  referenceFiles?: ReferenceFileSnapshot[];
};

export type GenerationContext = ImageGenerationContext | VideoGenerationContext;
```

修改 `StudioStoreRecord`：

```ts
type StudioStoreRecord = {
  imageJobs: Job[];
  imageAssets: Asset[];
  videoJobs: Job[];
  videoAssets: Asset[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
  referenceFiles: StudioReferenceFile[];
  pendingRestore?: {
    kind: JobKind;
    prompt: string;
    aspectRatio?: string;
    duration?: number;
    model?: string;
    selectedStartImageId?: string | null;
    selectedEndImageId?: string | null;
  };
};
```

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过（此时 `GenerationContext` 还未被使用，仅类型定义）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/project-store.ts src/lib/studio-store.ts
git commit -m "feat(types): add generationContext and pendingRestore types"
```

---

## Task 2: 图片生成时保存上下文

**Files:**
- Modify: `src/lib/studio-store.ts`

**Goal:** 无论 Mock 还是真实生成，创建 `Asset` 时都附带 `generationContext`。

- [ ] **Step 1: 修改 Mock 图片 Asset 创建**

在 `generateStandaloneImage` 函数内，找到 Mock 分支创建 `asset` 的地方：

```ts
const asset: Asset = {
  id: createId("asset"),
  kind: "image",
  title: draft.title?.trim() || "独立图片结果",
  prompt: promptText,
  previewUrl: createMockPreview("image", draft.title?.trim() || "独立图片结果", "#f97316"),
  createdAt,
  source: "mock"
};
```

替换为：

```ts
const asset: Asset = {
  id: createId("asset"),
  kind: "image",
  title: draft.title?.trim() || "独立图片结果",
  prompt: promptText,
  previewUrl: createMockPreview("image", draft.title?.trim() || "独立图片结果", "#f97316"),
  createdAt,
  source: "mock",
  generationContext: {
    kind: "image",
    prompt: promptText,
    aspectRatio: draft.aspectRatio,
    model: draft.model,
    referenceImage: record.referenceImage
      ? {
          id: record.referenceImage.id,
          title: record.referenceImage.title,
          previewUrl: record.referenceImage.previewUrl,
          storagePath: record.referenceImage.storagePath
        }
      : undefined
  }
};
```

- [ ] **Step 2: 修改真实图片 Asset 创建**

在 `processImageGenerationInBackground` 函数内，找到真实生成创建 `asset` 的地方：

```ts
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
```

替换为：

```ts
const store = await ensureStore();
const record = ensureUserRecord(store, ownerEmail);

const asset: Asset = {
  id: assetId,
  kind: "image",
  title: draft.title?.trim() || "独立图片结果",
  prompt: promptText,
  previewUrl: `/api/studio/assets/${assetId}`,
  createdAt: now(),
  source: "jimeng",
  storagePath,
  originalUrl: providerResult.imageUrl,
  generationContext: {
    kind: "image",
    prompt: promptText,
    aspectRatio: draft.aspectRatio,
    model: draft.model,
    referenceImage: record.referenceImage
      ? {
          id: record.referenceImage.id,
          title: record.referenceImage.title,
          previewUrl: record.referenceImage.previewUrl,
          storagePath: record.referenceImage.storagePath
        }
      : undefined
  }
};
```

注意这里需要在创建 `asset` 前重新读取 `store` 以获取当前 `referenceImage`（后台处理时可能已变化）。

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/lib/studio-store.ts
git commit -m "feat(studio): save image generation context to asset"
```

---

## Task 3: 视频生成时保存上下文

**Files:**
- Modify: `src/lib/studio-store.ts`

**Goal:** 无论 Mock 还是真实生成，创建视频 `Asset` 时都附带 `generationContext`。

- [ ] **Step 1: 修改 Mock 视频 Asset 创建**

在 `generateStandaloneVideo` 函数内，找到 Mock 分支创建 `asset` 的地方：

```ts
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
```

替换为：

```ts
const asset: Asset = {
  id: createId("asset"),
  kind: "video",
  title: "独立视频片段",
  prompt,
  previewUrl: createMockPreview("video", "独立视频片段", "#22c55e"),
  createdAt,
  durationSec: 5,
  source: "mock",
  generationContext: {
    kind: "video",
    prompt,
    aspectRatio,
    duration,
    model,
    referenceImage: record.referenceImage
      ? {
          id: record.referenceImage.id,
          title: record.referenceImage.title,
          previewUrl: record.referenceImage.previewUrl,
          storagePath: record.referenceImage.storagePath
        }
      : undefined,
    referenceEndImage: record.referenceEndImage
      ? {
          id: record.referenceEndImage.id,
          title: record.referenceEndImage.title,
          previewUrl: record.referenceEndImage.previewUrl,
          storagePath: record.referenceEndImage.storagePath
        }
      : undefined,
    selectedStartImageId,
    selectedEndImageId,
    referenceFiles: record.referenceFiles?.map(f => ({
      id: f.id,
      title: f.title,
      type: f.type,
      previewUrl: f.previewUrl,
      storagePath: f.storagePath
    }))
  }
};
```

- [ ] **Step 2: 修改真实视频 Asset 创建**

在 `processVideoGenerationInBackground` 函数内，找到真实生成创建 `asset` 的地方：

```ts
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
```

替换为：

```ts
const store = await ensureStore();
const record = ensureUserRecord(store, ownerEmail);

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
  durationSec: duration || 5,
  generationContext: {
    kind: "video",
    prompt,
    aspectRatio,
    duration,
    model,
    referenceImage: record.referenceImage
      ? {
          id: record.referenceImage.id,
          title: record.referenceImage.title,
          previewUrl: record.referenceImage.previewUrl,
          storagePath: record.referenceImage.storagePath
        }
      : undefined,
    referenceEndImage: record.referenceEndImage
      ? {
          id: record.referenceEndImage.id,
          title: record.referenceEndImage.title,
          previewUrl: record.referenceEndImage.previewUrl,
          storagePath: record.referenceEndImage.storagePath
        }
      : undefined,
    selectedStartImageId,
    selectedEndImageId,
    referenceFiles: record.referenceFiles?.map(f => ({
      id: f.id,
      title: f.title,
      type: f.type,
      previewUrl: f.previewUrl,
      storagePath: f.storagePath
    }))
  }
};
```

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/lib/studio-store.ts
git commit -m "feat(studio): save video generation context to asset"
```

---

## Task 4: 新增 `takePendingRestore` 辅助函数

**Files:**
- Modify: `src/lib/studio-store.ts`

**Goal:** 提供一个原子操作，读取并清空 `pendingRestore`。

- [ ] **Step 1: 在 `src/lib/studio-store.ts` 末尾新增函数**

```ts
export async function takePendingRestore(ownerEmail: string) {
  const store = await ensureStore();
  const record = ensureUserRecord(store, ownerEmail);
  const pending = record.pendingRestore;

  if (pending) {
    record.pendingRestore = undefined;
    await saveStore(store);
  }

  return pending || null;
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/lib/studio-store.ts
git commit -m "feat(studio): add takePendingRestore helper"
```

---

## Task 5: 新增恢复 API

**Files:**
- Create: `src/app/api/history/restore/route.ts`

**Goal:** 根据 `assetId` 恢复历史生成上下文到 `studio.json`。

- [ ] **Step 1: 创建 API 文件**

```ts
import { existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { ensureStore, saveStore } from "@/lib/studio-store";
import { requireSession } from "@/lib/session";
import type { JobKind } from "@/lib/project-store";
import type { GenerationContext } from "@/lib/studio-store";

const assetsDir = path.join(process.cwd(), "data", "assets");

type PendingRestore = {
  kind: JobKind;
  prompt: string;
  aspectRatio?: string;
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
    aspectRatio: context?.aspectRatio,
    duration: context?.duration,
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
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/history/restore/route.ts
git commit -m "feat(api): add POST /api/history/restore to restore generation context"
```

---

## Task 6: 工坊页面读取 `pendingRestore`

**Files:**
- Modify: `src/app/studio/images/page.tsx`
- Modify: `src/app/studio/videos/page.tsx`

**Goal:** 服务端读取并清空 `pendingRestore`，作为 prop 传给 Studio 组件。

- [ ] **Step 1: 修改图片工坊页面**

当前文件顶部导入：
```ts
import { getStudioState } from "@/lib/studio-store";
```

改为：
```ts
import { getStudioState, takePendingRestore } from "@/lib/studio-store";
```

在 `const state = await getStudioState(session.email);` 之后新增：
```ts
const pendingRestore = await takePendingRestore(session.email);
```

在 JSX 中，把 `<StandaloneImageStudio ... />` 改为传递 `pendingRestore`：

```tsx
<StandaloneImageStudio
  assets={state.imageAssets}
  jobs={state.imageJobs}
  referenceImage={state.referenceImage}
  pendingRestore={pendingRestore || undefined}
/>
```

- [ ] **Step 2: 修改视频工坊页面**

当前文件顶部导入：
```ts
import { getStudioState } from "@/lib/studio-store";
```

改为：
```ts
import { getStudioState, takePendingRestore } from "@/lib/studio-store";
```

在 `const state = await getStudioState(session.email);` 之后新增：
```ts
const pendingRestore = await takePendingRestore(session.email);
```

在 JSX 中，把 `<StandaloneVideoStudio ... />` 改为传递 `pendingRestore`：

```tsx
<StandaloneVideoStudio
  assets={state.videoAssets}
  jobs={state.videoJobs}
  referenceImage={state.referenceImage}
  referenceEndImage={state.referenceEndImage}
  imageAssets={state.imageAssets}
  referenceFiles={state.referenceFiles}
  pendingRestore={pendingRestore || undefined}
/>
```

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 此时 `StandaloneImageStudio` 和 `StandaloneVideoStudio` 还不接受 `pendingRestore` prop，会报类型错误。先记录，下一步再修复。

- [ ] **Step 4: Commit**

```bash
git add src/app/studio/images/page.tsx src/app/studio/videos/page.tsx
git commit -m "feat(studio): pass pendingRestore to studio components"
```

---

## Task 7: 更新 `StandaloneImageStudio`

**Files:**
- Modify: `src/components/standalone-image-studio.tsx`

**Goal:** 接收 `pendingRestore`、回填表单、显示参考图原名、紧凑排版。

- [ ] **Step 1: 扩展 props 类型**

扩展 props：
```ts
type StandaloneImageStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
  pendingRestore?: {
    prompt: string;
    aspectRatio?: Shot["aspectRatio"];
    model?: string;
  };
};
```

- [ ] **Step 2: 使用 `pendingRestore` 初始化状态**

在 `const [selectedModel, setSelectedModel] = ...` 之后添加：

```ts
const [restoredPrompt, setRestoredPrompt] = useState(pendingRestore?.prompt || "");
```

修改 `selectedAspectRatio` 的初始值：
```ts
const [selectedAspectRatio, setSelectedAspectRatio] = useState<Shot["aspectRatio"]>(
  (aspectRatios as string[]).includes(pendingRestore?.aspectRatio || "")
    ? (pendingRestore?.aspectRatio as Shot["aspectRatio"])
    : "9:16"
);
```

修改 `selectedModel` 的初始值：
```ts
const [selectedModel, setSelectedModel] = useState<typeof imageModels[number]["value"]>(
  imageModels.some(m => m.value === pendingRestore?.model)
    ? (pendingRestore?.model as typeof imageModels[number]["value"])
    : "jimeng-3.1"
);
```

在 `useEffect` 区域新增一个 effect 处理 `pendingRestore`：

```ts
useEffect(() => {
  if (pendingRestore) {
    setRestoredPrompt(pendingRestore.prompt);
    if ((aspectRatios as string[]).includes(pendingRestore.aspectRatio || "")) {
      setSelectedAspectRatio(pendingRestore.aspectRatio as Shot["aspectRatio"]);
    }
    if (imageModels.some(m => m.value === pendingRestore.model)) {
      setSelectedModel(pendingRestore.model as typeof imageModels[number]["value"]);
    }
    setMessage("已加载历史生成上下文，可直接修改后提交");
  }
}, [pendingRestore]);
```

- [ ] **Step 3: 让 textarea 受控并显示参考图原名**

把 textarea 改为受控：
```tsx
<textarea
  id="prompt"
  name="prompt"
  rows={3}
  placeholder="描述你想生成的图片..."
  required
  className="chat-textarea"
  value={restoredPrompt}
  onChange={(e) => setRestoredPrompt(e.target.value)}
/>
```

在参考图预览 `chat-reference-preview` 的 `img` 下方添加文件名：

```tsx
{referenceImage && (
  <div className="chat-reference-preview">
    <img src={referenceImage.previewUrl} alt={referenceImage.title} />
    <button type="button" className="chat-reference-remove" onClick={handleRemoveReference}>×</button>
    <span style={{ position: "absolute", bottom: "2px", left: "2px", right: "2px", fontSize: "11px", color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
      {referenceImage.title}
    </span>
  </div>
)}
```

- [ ] **Step 4: 更新提交成功后的清空逻辑**

由于 textarea 已改为受控组件，`form.reset()` 无法清掉 React state。在 `handleSubmit` 的成功分支中，把 `form.reset()` 替换为 `setRestoredPrompt("")`：

```ts
setMessage(data.message || "图片生成任务已提交，正在后台处理...");
setRestoredPrompt("");
router.refresh();
```

- [ ] **Step 5: 紧凑排版调整（修改 `src/app/globals.css`）**

在 `src/app/globals.css` 中调整聊天相关样式（图片/视频工坊共用同一套 CSS，只需改一次）：

```css
.chat-history-area {
  padding: 20px 16px;
  padding-bottom: 32px;
}

.chat-messages {
  gap: 12px;
}

.chat-message {
  padding: 14px 16px;
}

.chat-message-status {
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 6px;
}

.chat-input-area {
  padding: 12px;
  bottom: 16px;
  width: calc(100% - 32px);
}

.chat-references {
  gap: 8px;
  margin-bottom: 8px;
}

.chat-reference-preview {
  width: 72px;
  height: 72px;
  border-radius: 10px;
}

.chat-input-controls {
  gap: 8px;
}

.chat-toolbar {
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
}

.chat-tool-btn {
  padding: 8px 12px;
  font-size: 18px;
}

.chat-image-selector,
.chat-multimodal-selector {
  padding: 10px;
}
```

- [ ] **Step 6: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 7: Commit**

```bash
git add src/components/standalone-image-studio.tsx src/app/globals.css
git commit -m "feat(image-studio): restore context, show reference title, compact layout"
```

---

## Task 8: 更新 `StandaloneVideoStudio`

**Files:**
- Modify: `src/components/standalone-video-studio.tsx`

**Goal:** 接收 `pendingRestore`、回填表单、显示参考图/文件原名、多模态文件拖拽排序、紧凑排版。

- [ ] **Step 1: 扩展 props 类型**

```ts
type StandaloneVideoStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
  imageAssets: Asset[];
  referenceFiles: StudioReferenceFile[];
  pendingRestore?: {
    prompt: string;
    aspectRatio?: string;
    duration?: number;
    model?: string;
    selectedStartImageId?: string | null;
    selectedEndImageId?: string | null;
  };
};
```

- [ ] **Step 2: 使用 `pendingRestore` 初始化状态**

修改 `selectedAspectRatio` 初始值：
```ts
const [selectedAspectRatio, setSelectedAspectRatio] = useState<typeof aspectRatios[number]>(
  (aspectRatios as string[]).includes(pendingRestore?.aspectRatio || "")
    ? (pendingRestore?.aspectRatio as typeof aspectRatios[number])
    : "16:9"
);
```

修改 `selectedDuration` 初始值：
```ts
const [selectedDuration, setSelectedDuration] = useState<number>(
  pendingRestore?.duration && pendingRestore.duration >= 1 ? pendingRestore.duration : 5
);
```

修改 `selectedModel` 初始值：
```ts
const [selectedModel, setSelectedModel] = useState<typeof videoModels[number]["value"]>(
  videoModels.some(m => m.value === pendingRestore?.model)
    ? (pendingRestore?.model as typeof videoModels[number]["value"])
    : "doubao-seedance-1-5-pro-251215"
);
```

新增 `restoredPrompt` state：
```ts
const [restoredPrompt, setRestoredPrompt] = useState(pendingRestore?.prompt || "");
```

修改 `selectedStartImageId` / `selectedEndImageId` 初始值：
```ts
const [selectedStartImageId, setSelectedStartImageId] = useState<string | null>(pendingRestore?.selectedStartImageId ?? null);
const [selectedEndImageId, setSelectedEndImageId] = useState<string | null>(pendingRestore?.selectedEndImageId ?? null);
```

新增 effect：
```ts
useEffect(() => {
  if (pendingRestore) {
    setRestoredPrompt(pendingRestore.prompt);
    if ((aspectRatios as string[]).includes(pendingRestore.aspectRatio || "")) {
      setSelectedAspectRatio(pendingRestore.aspectRatio as typeof aspectRatios[number]);
    }
    if (pendingRestore.duration && pendingRestore.duration >= 1) {
      setSelectedDuration(pendingRestore.duration);
    }
    if (videoModels.some(m => m.value === pendingRestore.model)) {
      setSelectedModel(pendingRestore.model as typeof videoModels[number]["value"]);
    }
    if (pendingRestore.selectedStartImageId !== undefined) {
      setSelectedStartImageId(pendingRestore.selectedStartImageId);
    }
    if (pendingRestore.selectedEndImageId !== undefined) {
      setSelectedEndImageId(pendingRestore.selectedEndImageId);
    }
    setMessage("已加载历史生成上下文，可直接修改后提交");
  }
}, [pendingRestore]);

- [ ] **Step 3: 让 textarea 受控并显示参考图/文件原名**

textarea 改为受控：
```tsx
<textarea
  ref={textareaRef}
  id="prompt"
  name="prompt"
  rows={3}
  placeholder="描述你想生成的视频... (输入 @ 可引用图片)"
  required
  className="chat-textarea"
  value={restoredPrompt}
  onChange={(e) => setRestoredPrompt(e.target.value)}
  onKeyDown={handleTextareaKeyDown}
  onInput={handleTextareaInput}
/>
```

在 referenceImage / referenceEndImage / selectedStartImageId / selectedEndImageId 预览下方显示名称（已有预览区域，只需在 `img` 后加 `span`）。

对于 `referenceFiles` 的网格，每个文件卡片下方显示 `title`，并在右上角保留类型标签。

- [ ] **Step 4: 实现多模态文件拖拽排序**

新增 state 管理本地顺序：
```ts
const [orderedReferenceFiles, setOrderedReferenceFiles] = useState(referenceFiles);
const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

useEffect(() => {
  setOrderedReferenceFiles(referenceFiles);
}, [referenceFiles]);
```

为每个文件卡片添加拖拽事件：

```tsx
{orderedReferenceFiles.map((file, index) => (
  <div
    key={file.id}
    draggable
    onDragStart={() => setDraggingIndex(index)}
    onDragOver={(e) => {
      e.preventDefault();
    }}
    onDrop={(e) => {
      e.preventDefault();
      if (draggingIndex === null || draggingIndex === index) return;
      const newOrder = [...orderedReferenceFiles];
      const [moved] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(index, 0, moved);
      setOrderedReferenceFiles(newOrder);
      setDraggingIndex(null);
      fetch("/api/studio/reference-files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newOrder.map(f => f.id) })
      }).then(() => router.refresh()).catch(console.error);
    }}
    style={{
      position: "relative",
      border: "1px solid var(--line)",
      borderRadius: "6px",
      overflow: "hidden",
      cursor: "move",
      opacity: draggingIndex === index ? 0.5 : 1
    }}
  >
    {/* file preview */}
    {/* delete button */}
    <div style={{ padding: "4px 6px", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {file.title}
    </div>
  </div>
))}
```

- [ ] **Step 4: 更新提交成功后的清空逻辑**

与图片工坊一致，在 `handleSubmit` 的成功分支中把 `form.reset()` 替换为 `setRestoredPrompt("")`。

- [ ] **Step 5: 紧凑排版调整**

聊天界面紧凑样式已在 Task 7 中通过 `src/app/globals.css` 完成，本任务无需重复修改。

- [ ] **Step 6: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 7: Commit**

```bash
git add src/components/standalone-video-studio.tsx
git commit -m "feat(video-studio): restore context, show titles, drag reorder"
```

---

## Task 9: 新增多模态文件排序 API

**Files:**
- Modify: `src/app/api/studio/reference-files/route.ts`

**Goal:** 支持 `PATCH` 请求按 `orderedIds` 重排 `referenceFiles`。

- [ ] **Step 1: 在 `src/app/api/studio/reference-files/route.ts` 中新增 `PATCH` 方法**

在 `DELETE` 方法之前插入：

```ts
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
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/studio/reference-files/route.ts
git commit -m "feat(api): add PATCH /api/studio/reference-files for reordering"
```

---

## Task 10: 更新历史页并抽离 Client Component

**Files:**
- Create: `src/components/history-asset-card.tsx`
- Modify: `src/app/history/page.tsx`

**Goal:** 在历史页为每个资源卡片加“修改重跑”按钮，并整体紧凑排版。

- [ ] **Step 1: 创建 `src/components/history-asset-card.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Asset } from "@/lib/project-store";

type HistoryAssetCardProps = {
  asset: Asset;
};

export function HistoryAssetCard({ asset }: HistoryAssetCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleRestore() {
    startTransition(async () => {
      setError("");
      const res = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id })
      });
      const data = (await res.json()) as { ok: boolean; kind?: "image" | "video"; message?: string; missingReferences?: boolean };

      if (!res.ok || !data.ok) {
        setError(data.message || "恢复失败");
        return;
      }

      const target = data.kind === "image" ? "/studio/images" : "/studio/videos";
      if (data.missingReferences) {
        const separator = target.includes("?") ? "&" : "?";
        router.push(`${target}${separator}missingReferences=1`);
      } else {
        router.push(target);
      }
    });
  }

  return (
    <div
      className="result-card"
      style={{
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid var(--line)",
        background: "rgba(255, 255, 255, 0.03)",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
    >
      <div style={{ position: "relative" }}>
        {asset.kind === "video" ? (
          <video
            className="result-preview"
            src={asset.previewUrl}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              borderRadius: "8px"
            }}
          />
        ) : (
          <img
            className="result-preview"
            src={asset.previewUrl}
            alt={asset.title}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              borderRadius: "8px"
            }}
          />
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleRestore}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            background: "rgba(0,0,0,0.75)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "12px",
            cursor: "pointer"
          }}
        >
          {isPending ? "..." : "修改重跑"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "14px" }}>
          {asset.kind === "video" ? "🎬" : "🎨"}
        </span>
        <strong style={{ fontSize: "13px" }}>{asset.title}</strong>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
        {new Date(asset.createdAt).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </p>
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#ff9aa9" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/app/history/page.tsx` 使用 `HistoryAssetCard`**

在文件顶部新增导入：
```ts
import { HistoryAssetCard } from "@/components/history-asset-card";
```

把 `allAssets.map((asset) => (...))` 中的整个卡片 JSX 替换为：

```tsx
<HistoryAssetCard key={asset.id} asset={asset} />
```

- [ ] **Step 3: 紧凑排版历史页（修改 `src/app/history/page.tsx` 和 `src/app/globals.css`）**

在 `src/app/history/page.tsx` 中：
- 外层 `div style={{ display: "grid", gap: "24px" }}` 的 `gap` 改为 `16px`。
- 任务卡片的 `padding` 改为 `12px 16px`。
- 任务卡片内部 `gap` 改为 `10px`。
- 资源网格 `studio-result-grid` 的 `gap` 改为 `12px`（通过内联 style 或修改 globals.css）。

在 `src/app/globals.css` 中：

```css
.workspace-layout {
  padding: 24px 0 48px;
}

.workspace-topbar {
  gap: 12px;
  margin-bottom: 16px;
}

.studio-result-grid {
  gap: 12px;
}
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/components/history-asset-card.tsx src/app/history/page.tsx src/app/globals.css
git commit -m "feat(history): add modify-regenerate button and compact layout"
```

---

## Task 11: 处理缺失参考资源的提示

**Files:**
- Modify: `src/app/studio/images/page.tsx`
- Modify: `src/app/studio/videos/page.tsx`
- Modify: `src/components/standalone-image-studio.tsx`
- Modify: `src/components/standalone-video-studio.tsx`

**Goal:** 当恢复 API 返回 `missingReferences=true` 时，工坊页面显示提示。

- [ ] **Step 1: 在图片/视频工坊页面读取 URL 参数并传给组件**

在 `src/app/studio/images/page.tsx` 中：

```ts
import { requireSession } from "@/lib/session";
```

改为读取 searchParams：

```tsx
export default async function ImageStudioPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const missingReferences = params.missingReferences === "1";
  // ...existing code
}
```

传递 prop：
```tsx
<StandaloneImageStudio
  assets={state.imageAssets}
  jobs={state.imageJobs}
  referenceImage={state.referenceImage}
  pendingRestore={pendingRestore || undefined}
  missingReferences={missingReferences}
/>
```

视频工坊页面同样处理。

- [ ] **Step 2: 在 `StandaloneImageStudio` 和 `StandaloneVideoStudio` 中显示提示**

扩展 props：
```ts
missingReferences?: boolean;
```

在 `message` 初始化时合并：
```ts
useEffect(() => {
  if (missingReferences) {
    setMessage("部分历史参考资源已失效，请重新上传");
  }
}, [missingReferences]);
```

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/app/studio/images/page.tsx src/app/studio/videos/page.tsx src/components/standalone-image-studio.tsx src/components/standalone-video-studio.tsx
git commit -m "feat(studio): show missing reference warning after restore"
```

---

## Task 12: 端到端验证

**Files:**
- N/A

**Goal:** 确保所有改动协同工作，无类型错误和明显运行时错误。

- [ ] **Step 1: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过，无错误。

- [ ] **Step 2: 启动开发服务器并手动测试**

Run: `npm run dev`

打开浏览器测试：
1. 进入 `/studio/images`，生成一张图片（Mock 模式即可）。
2. 上传一张参考图，确认参考图下方显示原文件名。
3. 进入 `/history`，确认资源卡片右上角有“修改重跑”按钮。
4. 点击“修改重跑”，确认跳转到 `/studio/images`，提示词、比例、模型已回填，参考图已恢复。
5. 修改提示词并提交，确认 `/history` 出现两条独立记录。
6. 进入 `/studio/videos`，上传多张多模态文件，确认显示原文件名。
7. 拖拽文件换顺序，刷新页面后顺序保持一致。
8. 生成视频后进入 `/history`，点击视频“修改重跑”，确认参数和参考资源回填。
9. 删除 `data/assets/` 中某个参考文件后点击“修改重跑”，确认跳转后提示“部分历史参考资源已失效”。

- [ ] **Step 3: 检查 UI 紧凑度**

确认：
- 历史页面板、卡片间距明显缩小。
- 工坊聊天记录和输入区留白减少。
- 文字和按钮仍可正常阅读和点击。

- [ ] **Step 4: Commit（如测试中有修复）**

如有修复，按修改内容提交；如无需修复，本任务不提交。

---

## 自我审查

### Spec 覆盖检查

| Spec 要求 | 对应任务 |
|-----------|----------|
| Asset 存 generationContext | Task 1, 2, 3 |
| 历史页“修改重跑”入口 | Task 10 |
| POST /api/history/restore | Task 5 |
| pendingRestore 跨页传递 | Task 4, 6 |
| 工坊回填提示词/参数 | Task 7, 8 |
| 参考资源恢复 | Task 5 |
| 缺失参考资源提示 | Task 11 |
| 上传图片显示原名 | Task 7, 8 |
| 多模态文件拖拽排序 | Task 8, 9 |
| 历史页紧凑排版 | Task 10 |
| 工坊紧凑排版 | Task 7, 8 |

### Placeholder 扫描

- 无 TBD/TODO。
- 所有步骤包含具体代码或命令。
- 类型名称一致：`GenerationContext`、`ReferenceImageSnapshot`、`ReferenceFileSnapshot`、`pendingRestore`、`takePendingRestore`。

### 类型一致性

- `Asset.generationContext` 使用 `GenerationContext`。
- `pendingRestore` 结构在 `studio-store.ts`、API、页面、组件中一致。
- `takePendingRestore` 返回类型与组件 props 匹配。
