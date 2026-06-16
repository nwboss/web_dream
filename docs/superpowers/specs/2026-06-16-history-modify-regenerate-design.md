# 设计文档：历史记录“修改重跑”

## 背景与目标

当前项目在即梦漫剧工坊的 `/history` 页面展示了图片与视频的生成历史，包括：

- 进行中的任务（`processingJobs`）
- 已生成的资源（`allAssets`）
- 失败的任务（`failedJobs`）
- 已完成的任务（`completedJobs`）

用户在查看历史时，经常希望对某条历史提示词或结果做微调后重新生成。本设计目标是在 `/history` 页面为每个生成结果增加“修改重跑”入口，点击后把该次生成的完整上下文（提示词、生成参数、参考资源）恢复到对应工坊（`/studio/images` 或 `/studio/videos`），用户修改后提交即生成一条新记录。

## 设计决策

### 0. 上传图片名称与排序

作为本次改动的前置体验优化，所有上传图片需要：

- **保持原文件名显示**：`referenceImage`、`referenceEndImage` 的预览下方显示上传时的原始文件名；`referenceFiles` 的每个文件预览下方显示原始文件名。
- **多模态参考文件支持拖拽排序**：`referenceFiles` 列表中的文件支持拖拽换顺序，顺序影响 Seedance 2.0 生成时的参考优先级（先保存先使用，前端按数组顺序提交）。

### 0.5 排版紧凑化

历史页和工坊内部的聊天记录/输入框界面整体压缩内边距与间距，字体大小和组件尺寸保持不变：

- `/history` 页面：
  - 面板 `padding` 从当前 `24px` 级降到 `16px`。
  - 资源卡片网格 `gap` 从当前值降到 `12px`。
  - 任务卡片 `padding` 降到 `12px 16px`。
  - 卡片内部元素间距统一降到 `8px`。
- 工坊内部（`StandaloneImageStudio` / `StandaloneVideoStudio`）：
  - `chat-history-area` 中每条消息/记录的内边距降到 `10px 12px`。
  - 消息状态行与内容行间距降到 `4px`。
  - `chat-input-area` 输入框容器 `padding` 降到 `12px`。
  - 工具栏按钮、比例/模型选择 chip 的 `gap` 降到 `6px`。
  - 参考图预览区与输入框之间的间距降到 `8px`。

具体数值可在实现阶段根据实际效果微调，原则是“在保持可读性的前提下减少留白”。

### 1. 入口位置

仅在 `/history` 页面的“生成结果”区域（`allAssets`）为每个资源卡片增加“修改重跑”按钮。

- 进行中的任务、失败的任务、已完成的任务只读展示，不提供重跑入口。
- 入口放在资源卡片的右上角操作区，不破坏现有预览布局。

### 2. 可编辑范围

点击“修改重跑”后，恢复到工坊的上下文包括：

- **提示词**（`prompt`）
- **生成参数**：
  - 图片：宽高比（`aspectRatio`）、模型（`model`）
  - 视频：宽高比（`aspectRatio`）、时长（`duration`）、模型（`model`）
- **参考资源**：
  - 图片：参考图（`referenceImage`）
  - 视频：首帧参考图（`referenceImage`）、尾帧参考图（`referenceEndImage`）、已选首尾帧素材 ID（`selectedStartImageId`、`selectedEndImageId`）、多模态参考文件（`referenceFiles`，顺序会被保留）

### 3. 记录关系

“修改重跑”生成的新结果作为一条全新的 `Job` 和 `Asset` 追加到用户历史中，原记录完整保留。历史页按时间倒序展示多条独立记录。

### 4. 总体架构

采用“历史页触发恢复 + 工坊负责回填与生成”的方案：

1. 历史页点击“修改重跑”。
2. 前端调用 `POST /api/history/restore`，传入 `assetId`。
3. 后端读取该 `Asset` 的 `generationContext`，把参考资源恢复到当前用户的 `studio.json` 中，并把简单参数写入待恢复状态。
4. 后端返回 `{ ok: true, kind: "image" | "video" }`。
5. 前端跳转到 `/studio/images` 或 `/studio/videos`。
6. 工坊页面加载时读取待恢复状态，初始化表单。
7. 用户修改后提交，生成新记录，并在新 `Asset` 中再次保存完整的 `generationContext`。

## 数据模型变更

### `Asset` 类型扩展

在 `src/lib/project-store.ts` 的 `Asset` 类型中新增 `generationContext` 字段：

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

`GenerationContext` 定义在 `src/lib/studio-store.ts`（或独立类型文件），结构如下：

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

### `StudioStoreRecord` 扩展

在 `src/lib/studio-store.ts` 的 `StudioStoreRecord` 中新增 `pendingRestore` 字段，用于跨页面传递待恢复状态：

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

`pendingRestore` 只保存简单标量参数；参考资源通过直接覆盖 `referenceImage` / `referenceEndImage` / `referenceFiles` 来恢复。

## 服务端变更

### 1. 生成时保存上下文

#### 图片生成 `generateStandaloneImage`

在创建 `Asset` 时，追加 `generationContext`：

```ts
const asset: Asset = {
  // ...existing fields
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

Mock 模式下同样需要保存上下文，以便 Mock 结果也能被修改重跑。

#### 视频生成 `generateStandaloneVideo`

在创建 `Asset` 时，追加 `generationContext`：

```ts
const asset: Asset = {
  // ...existing fields
  generationContext: {
    kind: "video",
    prompt,
    aspectRatio,
    duration,
    model,
    referenceImage: record.referenceImage
      ? { id, title, previewUrl, storagePath }
      : undefined,
    referenceEndImage: record.referenceEndImage
      ? { id, title, previewUrl, storagePath }
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

### 2. 新增恢复 API

新增文件 `src/app/api/history/restore/route.ts`：

- 方法：`POST`
- 鉴权：通过 `requireSession()` 获取当前用户邮箱
- 请求体：`{ assetId: string }`
- 逻辑：
  1. 在 `studio.json` 中查找 `imageAssets` 和 `videoAssets` 中匹配的 `Asset`。
  2. 若不存在，返回 `404`。
  3. 读取 `asset.generationContext`：
     - 若不存在，回退到仅 `prompt` 和 `kind`。
  4. 恢复参考资源：
     - 验证 `storagePath` 对应的文件是否仍存在于 `data/assets/`。
     - 若存在，设置到 `referenceImage` / `referenceEndImage` / `referenceFiles`（`createdAt` 使用当前时间）。
     - 若不存在，标记 `missingReferences = true`。
  5. 对于视频上下文中的 `selectedStartImageId` / `selectedEndImageId`，需额外验证对应 asset 是否仍存在于 `record.imageAssets`：
     - 若存在，写入 `pendingRestore`。
     - 若不存在，不写入对应字段并标记 `missingReferences = true`。
  6. 写入 `pendingRestore`（包含简单参数和验证通过的首尾帧 ID）。
  7. 保存 `studio.json`。
  8. 返回 `{ ok: true, kind, missingReferences }`。

### 3. 工坊页面读取 `pendingRestore`

`getStudioState` 返回的结构需要扩展 `pendingRestore` 字段；或者在 `studio-store.ts` 中新增 `takePendingRestore(ownerEmail)` 函数，读取并清空 `record.pendingRestore`。

`src/app/studio/images/page.tsx` 和 `src/app/studio/videos/page.tsx` 在获取 studio 状态后：

- 若存在且 `kind` 匹配，把 `pendingRestore` 作为 prop 传给对应 Studio 组件，并在渲染前清空 `pendingRestore`（避免刷新后重复回填）。
- 若 `kind` 不匹配，忽略或清空。

## 上传图片体验优化

### 1. 显示原始文件名

- `referenceImage` / `referenceEndImage` 预览组件下方增加一行显示 `title`（即上传时的原始文件名）。
- `referenceFiles` 的每个文件卡片下方显示 `title`，并在右上角保留小的 `file.type` 类型标签。
- 文件名过长时做截断处理（如 `max-width: 100%`，`text-overflow: ellipsis`）。

### 2. 多模态参考文件拖拽排序

#### 前端实现

在 `StandaloneVideoStudio` 的多模态文件网格中启用拖拽排序：

- 每个文件卡片设置 `draggable="true"`。
- 监听 `onDragStart` 记录被拖动项的索引。
- 监听 `onDragOver` 阻止默认行为并计算放置位置。
- 监听 `onDrop` 调用 API 更新服务器端顺序，或先本地重排再同步。

推荐实现：**本地即时重排 + API 同步**。即拖拽完成后先更新本地状态提供即时反馈，再调用 `PATCH /api/studio/reference-files` 把新顺序持久化。

#### 后端 API

新增/扩展 `src/app/api/studio/reference-files/route.ts`：

- 新增 `PATCH` 方法：
  - 请求体：`{ orderedIds: string[] }`
  - 逻辑：按 `orderedIds` 重排 `record.referenceFiles`，缺失的 ID 保持原顺序追加在末尾，保存 `studio.json`。
  - 返回：`{ ok: true }`

#### 与修改重跑的关联

`VideoGenerationContext.referenceFiles` 需要按当前数组顺序保存快照；恢复时把该顺序写回 `record.referenceFiles`，保证历史上下文中的参考文件顺序一致。

## 前端变更

### 1. `/history` 页面

在 `src/app/history/page.tsx` 的每个资源卡片上增加“修改重跑”按钮：

```tsx
<button
  type="button"
  className="btn btn-ghost btn-sm"
  onClick={async () => {
    const res = await fetch("/api/history/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id })
    });
    const data = await res.json();
    if (data.ok) {
      router.push(data.kind === "image" ? "/studio/images" : "/studio/videos");
    } else {
      alert(data.message || "恢复失败");
    }
  }}
>
  修改重跑
</button>
```

由于 `HistoryPage` 是 Server Component，需要把资源卡片抽成 Client Component，或在页面中增加 `"use client"`。推荐新增 `HistoryAssetCard` Client Component，保持页面其余部分仍为 Server Component。

### 2. `/studio/images` 页面

- 从 `getStudioState` 读取 `pendingRestore` 并传给 `StandaloneImageStudio`。
- 在传给组件前清空 `pendingRestore`。

### 3. `/studio/videos` 页面

- 从 `getStudioState` 读取 `pendingRestore` 并传给 `StandaloneVideoStudio`。
- 在传给组件前清空 `pendingRestore`。

### 4. `StandaloneImageStudio`

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

在组件初始化时，若 `pendingRestore` 存在：

- 设置 `selectedAspectRatio`；若历史值不在当前可选列表中，回退到默认值 `9:16`。
- 设置 `selectedModel`；若历史值不在当前可选列表中，回退到默认值。
- 把 `prompt` 填入 `textarea`（通过 `ref` 或受控组件）。
- 设置 `message` 提示用户“已加载历史生成上下文”。

### 5. `StandaloneVideoStudio`

扩展 props：

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
  };
};
```

初始化逻辑与图片工坊类似；若历史上下文中有 `selectedStartImageId` / `selectedEndImageId`，则设置到状态，否则保持 `null`。历史模型/比例若不在当前可选列表中，回退到默认值。

## 错误处理

| 场景 | 处理 |
|------|------|
| 历史记录没有 `generationContext` | 仅回填 `prompt`，其余使用当前工坊默认值，提示“已回填历史提示词，部分参数不可用”。 |
| 历史参考资源文件已删除 | `missingReferences = true`，跳转后在工坊状态栏提示“部分历史参考资源已失效，请重新上传”。 |
| 恢复 API 鉴权失败 | 走现有 middleware 返回 401/403。 |
| 恢复 API 找不到 asset | 返回 `404 { ok: false, message: "未找到该生成记录" }`。 |
| 工坊页面读取 `pendingRestore` 后清空失败 | 不影响功能，仅可能导致刷新后再次回填；通过 server action 写入后忽略写失败日志。 |

## 测试策略

1. **单元测试/手动测试**
   - 上传参考图/多模态文件，确认预览下方显示原始文件名。
   - 在多模态文件区域拖拽文件换顺序，刷新页面后顺序保持一致。
   - 检查 `/history` 页面和工坊聊天界面，确认整体留白减少、信息密度提升，同时文字和按钮仍易读易点。
   - Mock 模式下生成一张图片，进入历史页点击“修改重跑”，确认跳转后提示词、比例、模型正确回填。
   - 修改提示词后提交，确认历史页出现两条独立记录。
   - 删除原参考图文件后点击“修改重跑”，确认跳转后提示“部分历史参考资源已失效”。

2. **回归测试**
   - 确认不点击“修改重跑”时，工坊页面行为不变。
   - 确认 `/history` 页面在无 `generationContext` 的旧数据下不报错。
   - 确认旧版 `studio.json`（无 `referenceFiles` 或 `generationContext`）能正常读取。

## 依赖与影响范围

- 修改文件：
  - `src/lib/project-store.ts`（类型扩展，可选回填兼容）
  - `src/lib/studio-store.ts`（类型扩展、生成时保存上下文、新增恢复函数）
  - `src/app/history/page.tsx`（新增按钮与 Client Component、调整紧凑排版）
  - `src/app/studio/images/page.tsx`（读取 pendingRestore）
  - `src/app/studio/videos/page.tsx`（读取 pendingRestore）
  - `src/app/api/studio/reference-files/route.ts`（新增 PATCH 排序接口）
  - `src/components/standalone-image-studio.tsx`（初始化回填、显示参考图原名、调整紧凑排版）
  - `src/components/standalone-video-studio.tsx`（初始化回填、显示参考图/文件原名、拖拽排序、调整紧凑排版）
- 新增文件：
  - `src/app/api/history/restore/route.ts`
  - `src/components/history-asset-card.tsx`（可选）

## 非目标

- 不在历史页直接提供 Inline 编辑表单。
- 不记录版本链或“基于某记录修改”的关联关系。
- 不修改项目/分镜级别的生成逻辑（`project-store.ts` 中的 `Asset` 可不保存 `generationContext`，后续如需要再扩展）。
- `referenceImage` / `referenceEndImage` 为单文件上传，不支持排序。
