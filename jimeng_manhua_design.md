# 即梦 AI 漫剧生成网页设计文档

## 1. 文档目标

本文档用于设计一个“集成即梦 AI API 的漫剧生成网页”，支持：

- 文生图
- 图生图
- 文生视频
- 图生视频
- 将分镜图片与分镜视频统一组织为一部可预览、可编辑、可导出的“漫剧项目”

目标是先落地一个可商用扩展的 MVP，再逐步增强为完整的 AI 漫剧生产台。

## 2. 产品定位

### 2.1 产品一句话

一个面向内容创作者、短剧团队、MCN 和个人作者的 AI 漫剧创作工作台，用户可以通过脚本、角色设定、分镜描述，批量生成图片和视频素材，并编排为可播放的漫剧成片。

### 2.2 核心价值

- 降低漫剧创作门槛：不需要会绘画或剪辑，也能快速出片
- 提升产能：将“脚本 -> 分镜 -> 素材 -> 视频片段 -> 合成输出”流程产品化
- 统一管理图片与视频：避免素材散落、版本混乱、角色不一致
- 支持人工修订：AI 生成后仍能二次编辑，不把用户锁死在一次性结果里

### 2.3 目标用户

- 漫剧短视频创作者
- 小说推文改编团队
- 自媒体内容工作室
- IP 二创作者
- 电商剧情号/品牌故事号运营团队

## 3. 业务范围

### 3.1 本期范围

- 用户输入故事简介、角色设定、剧本或分镜文本
- 系统拆分为多个分镜卡片
- 每个分镜支持：
  - 生成静态图
  - 生成动态视频
  - 上传参考图后进行图生图或图生视频
- 项目级管理：
  - 剧集
  - 场次
  - 分镜
  - 素材版本
- 结果预览：
  - 图片瀑布流/时间线
  - 视频播放器
  - 分镜连续播放
- 导出：
  - 导出项目素材清单
  - 导出分镜图集
  - 导出视频片段清单

### 3.2 暂不纳入首期

- 完整非编剪辑系统
- 自动配音和字幕烧录
- 多人实时协作编辑
- 复杂计费中心
- 微信/抖音小程序版本
- 超大规模队列调度平台

## 4. 用户场景

### 4.1 场景一：从脚本快速生成漫剧草案

用户输入故事梗概与角色设定，系统自动拆成 10~30 个分镜。用户逐个点击“生成图片”或“生成视频”，快速得到一版漫剧草案。

### 4.2 场景二：先定角色，再批量生成一致画面

用户上传角色立绘或参考图，系统在后续分镜里持续引用该角色参考，减少人脸、服装、画风漂移。

### 4.3 场景三：用静态图进一步生成动效片段

用户先通过文生图确定每个镜头画面，再对选中的图片执行图生视频，形成 3~8 秒的动态镜头。

## 5. 核心功能设计

## 5.1 信息架构

系统采用 4 层对象模型：

1. 工作区 Workspace
2. 项目 Project
3. 场次 Scene
4. 分镜 Shot

附属对象：

- Character：角色设定
- Asset：生成结果素材
- Job：AI 生成任务
- Template：提示词模板

### 5.2 页面结构

建议采用桌面优先的三栏工作台布局。

#### 页面 A：首页 / 项目列表

功能：

- 新建项目
- 最近项目
- 模板项目
- 项目搜索、筛选、复制

#### 页面 B：项目工作台

布局：

- 左栏：项目结构树
  - 角色
  - 场次
  - 分镜列表
- 中栏：当前分镜编辑区
  - 分镜描述
  - 提示词
  - 参考图
  - 参数面板
  - 生成按钮
- 右栏：素材结果区
  - 图片结果
  - 视频结果
  - 历史版本
  - 失败重试记录

#### 页面 C：项目预览页

功能：

- 连续预览分镜
- 按场次播放
- 查看图片/视频混排时间线
- 选择导出素材

#### 页面 D：系统设置页

功能：

- 配置即梦 API Key
- 默认模型与参数
- 素材存储配置
- 安全策略和内容审核策略

## 5.3 分镜工作流

每个分镜支持以下状态流转：

`草稿 -> 待生成 -> 生成中 -> 生成成功 -> 已选为正式版`

每个分镜下允许存在多个素材版本：

- V1：首版图片
- V2：图生图微调
- V3：由 V2 转视频

用户可以将任意版本标记为：

- 当前主版本
- 备用版本
- 废弃版本

### 5.4 图片生成功能

支持两类主要入口：

- 文生图
- 图生图

关键参数：

- 画幅比例
- 分辨率档位
- 风格模板
- 角色一致性提示
- 负面提示词
- 返回数量

交互要求：

- 支持单次生成多张候选图
- 支持对单张结果进行“重绘 / 局部修正 / 延展 / 超清”
- 支持将某张图设为后续镜头参考图

### 5.5 视频生成功能

支持三类入口：

- 文生视频
- 图生视频（首帧）
- 图生视频（首尾帧）

扩展能力：

- 运镜控制
- 时长档位
- 清晰度档位
- 动作强度
- 画面稳定性偏好

交互要求：

- 视频任务为异步创建，前端需轮询任务状态
- 任务生成中可离开页面，回来后继续查看
- 支持失败重试
- 支持引用图片生成结果为视频首帧

### 5.6 角色与风格一致性

这是漫剧产品的核心体验之一。

设计上需要提供两种一致性机制：

#### 方案一：软一致性

通过提示词模板持续注入：

- 角色名字
- 性别年龄
- 发型发色
- 服装特征
- 表情气质
- 画风标签

优点：

- 实现简单
- 成本低

缺点：

- 稳定性有限

#### 方案二：参考图一致性

用户上传角色参考图，后续分镜在图生图或图生视频环节引用该参考。

优点：

- 一致性更强

缺点：

- 对素材质量要求高

建议首期同时支持两种方案，并在 UI 中明确“是否启用角色参考图”。

### 5.7 提示词系统

提示词不要只让用户自由输入，而应采用“结构化输入 + 自由补充”的模式。

建议拆为以下字段：

- 画面主体
- 场景环境
- 镜头语言
- 动作描述
- 情绪氛围
- 画风标签
- 负面提示词

系统最终拼接为可审计、可复用、可模板化的 prompt。

示例：

- 主体：17 岁短发少女，校服，神情倔强
- 场景：暴雨夜的旧巷口，霓虹反光
- 镜头：中近景，轻微仰拍
- 动作：她握紧书包肩带，回头看向身后
- 风格：国漫、电影感光影、细腻笔触

### 5.8 项目预览与导出

预览支持两种模式：

- 分镜模式：逐卡浏览素材
- 播放模式：按分镜顺序自动播放图片与视频

导出首期建议支持：

- `JSON` 项目结构文件
- `ZIP` 素材包
- 分镜清单 `CSV`

后续可以增加：

- 一键合成 MP4
- 字幕文件 `SRT`
- 配音轨道

## 6. 技术方案

## 6.1 推荐技术栈

### 前端

- Next.js
- TypeScript
- Tailwind CSS
- Zustand 或 TanStack Query
- React Hook Form + Zod
- Video.js 或原生 video 组件

### 后端

- Next.js Route Handlers 或 NestJS
- PostgreSQL
- Redis
- 对象存储：S3 兼容存储或火山引擎对象存储

### 基础设施

- Docker
- Nginx
- PM2 或 Node 进程管理

如果你想尽快上线 MVP，建议：

- 前后端一体：`Next.js + PostgreSQL + Redis`

这样开发成本最低，页面和 API 可以一起演进。

## 6.2 系统模块拆分

后端建议拆分为以下模块：

### 1. Auth 模块

- 用户登录
- API Key 归属
- 会话管理

### 2. Project 模块

- 项目 CRUD
- 场次和分镜 CRUD
- 项目复制

### 3. Prompt 模块

- 结构化提示词拼装
- 模板管理
- Prompt 历史版本

### 4. Asset 模块

- 图片和视频素材管理
- 素材元数据
- 素材版本关联

### 5. Job 模块

- 创建生成任务
- 查询任务状态
- 重试机制
- 并发与限流

### 6. Jimeng Provider 模块

- 统一封装即梦 API
- 图片生成适配器
- 视频生成适配器
- 错误码转换

### 7. Storage 模块

- 上传原图
- 保存结果图/视频
- 生成缩略图

## 6.3 推荐架构

建议采用“前端工作台 + 后端 BFF + 任务队列”的结构。

```text
Browser
  -> Web App (Next.js)
  -> BFF API
  -> Job Queue / Worker
  -> Jimeng API
  -> Object Storage
  -> PostgreSQL / Redis
```

原因：

- 图片与视频生成都不是实时秒回场景
- 视频生成天然适合异步任务架构
- 统一任务中心后，未来接入其他模型也更容易

## 7. 即梦 AI API 集成设计

## 7.1 集成原则

不要在前端直接调用即梦 API，必须通过后端代理层完成。

原因：

- 保护 API Key
- 统一鉴权、计费和审计
- 对不同模型做统一参数适配
- 后续可切换供应商

## 7.2 能力抽象

后端统一定义能力接口：

### 图片接口

- `generateImageByText()`
- `generateImageByReference()`

### 视频接口

- `generateVideoByText()`
- `generateVideoByImage()`
- `generateVideoByFirstLastFrame()`
- `queryVideoJob()`

### 通用接口

- `listModels()`
- `normalizeError()`
- `saveRemoteResult()`

## 7.3 任务模型

所有生成请求都抽象为 `Job`：

- `type`: image | video
- `mode`: text2image | image2image | text2video | image2video | first_last_frame_video
- `status`: queued | submitted | processing | succeeded | failed
- `provider`: jimeng
- `provider_job_id`
- `request_payload`
- `response_payload`
- `error_code`
- `error_message`

### 任务处理流程

1. 前端提交生成请求
2. 后端校验参数并创建本地任务
3. Worker 调用即梦 API
4. 若是同步图片接口，直接拿到结果并入库
5. 若是异步视频接口，保存 `provider_job_id`
6. 定时轮询视频任务状态
7. 完成后下载或登记结果素材 URL
8. 回写素材表与分镜主版本

## 7.4 图片与视频统一建模

建议统一素材表 `assets`，用 `asset_type` 区分：

- image
- video

共有字段：

- `id`
- `project_id`
- `scene_id`
- `shot_id`
- `job_id`
- `asset_type`
- `source_type`
- `storage_key`
- `preview_url`
- `width`
- `height`
- `duration_ms`
- `prompt_text`
- `model_name`
- `version_no`
- `is_primary`

这样图片和视频就能在同一条分镜时间线上混排显示。

## 7.5 参数映射策略

即梦不同模型的参数并不一定完全一致，因此不要让前端直接绑定供应商字段。

前端使用统一参数：

- `aspectRatio`
- `qualityLevel`
- `duration`
- `cameraMovement`
- `stylePreset`
- `referenceImages`

后端 Provider 层负责映射为即梦真实请求结构。

这样后续切到别的模型时，前端几乎不用改。

## 7.6 当前可参考的即梦公开能力边界

根据火山引擎公开文档与官方文章，适合本项目优先接入的能力包括：

- 即梦文生图 3.0
- 即梦文生图 3.1
- 即梦图生图 3.0 智能参考
- 即梦图片生成 4.0
- 即梦视频生成 3.0 720P
- 即梦视频生成 3.0 1080P
- 即梦视频生成 3.0 Pro
- 图生视频首帧
- 图生视频首尾帧

一个关键事实是：视频生成接口按公开文档是异步任务模式，需要先创建任务，再按任务 ID 查询结果。这一点会直接决定我们的后端 Job 设计。

## 8. 数据库设计

以下为推荐核心表。

## 8.1 users

- `id`
- `email`
- `name`
- `password_hash`
- `created_at`

## 8.2 projects

- `id`
- `user_id`
- `title`
- `description`
- `cover_asset_id`
- `status`
- `created_at`
- `updated_at`

## 8.3 scenes

- `id`
- `project_id`
- `title`
- `sort_order`

## 8.4 shots

- `id`
- `scene_id`
- `title`
- `shot_text`
- `prompt_structured_json`
- `negative_prompt`
- `sort_order`
- `status`

## 8.5 characters

- `id`
- `project_id`
- `name`
- `profile_json`
- `reference_asset_id`

## 8.6 jobs

- `id`
- `project_id`
- `shot_id`
- `type`
- `mode`
- `provider`
- `provider_job_id`
- `status`
- `request_json`
- `response_json`
- `error_message`
- `created_at`
- `updated_at`

## 8.7 assets

- `id`
- `project_id`
- `scene_id`
- `shot_id`
- `job_id`
- `asset_type`
- `mime_type`
- `storage_key`
- `preview_url`
- `meta_json`
- `version_no`
- `is_primary`
- `created_at`

## 9. API 设计

## 9.1 前端业务 API

### 项目接口

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`

### 场次与分镜接口

- `POST /api/projects/:id/scenes`
- `POST /api/scenes/:id/shots`
- `PATCH /api/shots/:id`
- `PATCH /api/shots/:id/reorder`

### 图片生成接口

- `POST /api/shots/:id/generate-image`

请求体示例：

```json
{
  "mode": "text2image",
  "prompt": {
    "subject": "黑发少年站在天台边缘",
    "scene": "黄昏城市高楼",
    "camera": "中景",
    "mood": "压抑、命运感",
    "style": "国漫、电影感"
  },
  "aspectRatio": "9:16",
  "qualityLevel": "high",
  "referenceAssetIds": []
}
```

### 视频生成接口

- `POST /api/shots/:id/generate-video`

请求体示例：

```json
{
  "mode": "image2video",
  "promptText": "镜头缓慢推进，少年抬头，风吹动发梢",
  "duration": 5,
  "qualityLevel": "1080p",
  "cameraMovement": "push_in",
  "referenceAssetIds": ["img_xxx"]
}
```

### 任务接口

- `GET /api/jobs/:id`
- `POST /api/jobs/:id/retry`

### 素材接口

- `GET /api/shots/:id/assets`
- `POST /api/assets/:id/set-primary`

## 9.2 Provider 内部接口

内部封装建议统一返回：

```ts
type ProviderResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retriable: boolean;
  };
};
```

## 10. 前端交互设计

## 10.1 主工作台交互

### 分镜卡片

每个分镜卡片展示：

- 分镜标题
- 分镜描述
- 当前主素材缩略图
- 生成状态
- 失败提示
- 快捷操作按钮

按钮建议：

- 生成图
- 生成视频
- 重新生成
- 设为主版本
- 删除版本

### 参数面板

参数面板分为三组：

- 基础信息
- 图片参数
- 视频参数

图片模式下隐藏视频参数，视频模式下显示视频参数。

### 版本对比

图片支持左右滑动对比。

视频支持：

- 封面缩略图
- 时长
- 分辨率
- 播放按钮

## 10.2 状态反馈

任务状态必须非常明确：

- 已提交
- 排队中
- 生成中
- 已完成
- 失败

视频任务建议显示：

- 提交时间
- 已等待时长
- 最近轮询时间

## 11. 异步任务与队列设计

## 11.1 为什么要队列

图片和视频都可能存在：

- 调用耗时
- 服务限流
- 批量任务堆积
- 第三方失败重试

因此建议引入 Redis 队列。

## 11.2 Job Worker 行为

Worker 逻辑：

1. 从队列取任务
2. 调用 Jimeng Provider
3. 按返回类型判断是同步结果还是异步任务
4. 写入数据库
5. 对异步视频任务加入 poll 队列
6. 超时后自动标记失败

## 11.3 重试策略

可重试错误：

- 网络抖动
- 第三方 5xx
- 临时限流

不可重试错误：

- 参数缺失
- 内容审核不通过
- 账户额度不足

建议：

- 自动重试 2 次
- 指数退避
- 前端允许手动重试

## 12. 存储设计

素材来源分为三类：

- 用户上传原图
- 即梦返回结果
- 系统生成缩略图/封面

建议目录结构：

```text
projects/{projectId}/shots/{shotId}/uploads/
projects/{projectId}/shots/{shotId}/images/
projects/{projectId}/shots/{shotId}/videos/
projects/{projectId}/shots/{shotId}/thumbnails/
```

需要记录：

- 原始文件 URL
- 缩略图 URL
- 封面图 URL
- 文件大小
- MIME 类型

## 13. 安全与合规

## 13.1 API Key 安全

- 即梦 API Key 仅保存在服务端
- 前端不暴露第三方密钥
- 关键调用写审计日志

## 13.2 上传安全

- 限制文件类型
- 限制文件大小
- 做基础内容扫描

## 13.3 内容审核

建议至少做两层：

- 用户输入文案审核
- 结果素材状态标记

避免出现违规内容直接进入公开传播链路。

## 14. 性能与可扩展性

## 14.1 性能重点

- 首页项目列表分页
- 分镜素材懒加载
- 视频缩略图预生成
- 长轮询改为短轮询 + 服务端缓存

## 14.2 可扩展方向

未来可扩展为多模型平台：

- JimengProvider
- SeedreamProvider
- SeedanceProvider
- KlingProvider
- WanProvider

前端不感知具体供应商，只感知“图片能力”和“视频能力”。

## 15. MVP 版本规划

## 15.1 MVP 必做

- 项目创建
- 场次/分镜管理
- 文生图
- 图生图
- 文生视频
- 图生视频
- 异步任务状态追踪
- 图片/视频素材版本管理
- 项目预览

## 15.2 第二阶段

- 首尾帧视频
- 角色库
- Prompt 模板库
- 批量生成
- 项目导出 ZIP

## 15.3 第三阶段

- 自动配音
- 字幕生成
- 一键合成漫剧成片
- 团队协作
- 计费系统

## 16. 推荐开发顺序

### 第 1 周

- 搭前后端项目骨架
- 建数据库表
- 完成项目/场次/分镜 CRUD

### 第 2 周

- 接入图片生成
- 完成素材入库与展示
- 做版本管理

### 第 3 周

- 接入视频生成
- 完成异步任务轮询
- 完成项目预览页

### 第 4 周

- 打磨交互
- 完成导出
- 做基础审计与错误处理

## 17. 风险点

### 风险一：角色一致性不足

即使使用参考图，跨镜头一致性仍可能不稳定。

应对：

- 强化角色模板
- 允许用户锁定角色参考图
- 提供“沿用上一镜头主图”为参考图的快捷入口

### 风险二：视频生成耗时长

应对：

- 全异步任务化
- 给出清晰进度反馈
- 支持离线等待与回到项目继续查看

### 风险三：供应商参数变更

应对：

- Provider 层做适配
- 前端使用统一参数模型
- 对模型版本做后台配置化

## 18. 推荐 UI 风格

建议采用“创作工作台”风格而不是普通后台风格。

视觉建议：

- 深灰蓝或胶片黑背景
- 高对比内容卡片
- 分镜卡片像剪辑时间线与漫画页面结合
- 图片结果用大缩略图展示
- 视频结果带悬浮播放

关键词：

- 创作感
- 电影感
- 专业但不复杂

## 19. 结论

这个产品最关键的不是单纯“接一个即梦接口”，而是把图片生成、视频生成、分镜管理、版本管理、异步任务追踪整合成一条完整的漫剧生产流程。

从架构上，最重要的三个决策是：

1. 用项目/场次/分镜三层模型组织内容
2. 用统一 Job 系统承接图片和视频生成
3. 用 Provider 层隔离即梦 API 细节

只要这三个基础打稳，后续不管是加配音、字幕、导出成片，还是切换更多模型，成本都会低很多。

## 20. 本文档基于的公开信息说明

本文档中的“即梦公开能力边界”基于我在 2026-03-26 检索到的火山引擎公开资料整理，重点参考了以下页面：

- 即梦 AI 官方站点：<https://jimeng.jianying.com/>
- 火山引擎开发者文章《即梦AI携手火山引擎全面开放API服务！》：<https://developer.volcengine.com/articles/7546180861461266483>
- 火山引擎即梦文档目录：<https://www.volcengine.com/docs/85621>
- 即梦图片生成 4.0 接口文档：<https://www.volcengine.com/docs/85621/1817045>
- 即梦文生图 3.1 接口文档：<https://www.volcengine.com/docs/85621/1756900>
- 即梦图生图 3.0 智能参考接口文档：<https://www.volcengine.com/docs/85621/1747301>
- 即梦视频生成 3.0 Pro 接口文档：<https://www.volcengine.com/docs/85621/1777001>
- 即梦视频生成 3.0 1080P 接口文档：<https://www.volcengine.com/docs/85621/1792711>
- 即梦视频生成 3.0 720P 文生视频接口文档：<https://www.volcengine.com/docs/85621/1792704>
- 即梦视频生成 3.0 720P 图生视频运镜接口文档：<https://www.volcengine.com/docs/85621/1785201>
- 即梦视频生成 3.0 1080P 图生视频首尾帧接口文档：<https://www.volcengine.com/docs/85621/1802721>

由于部分官方文档详情页依赖前端脚本渲染，本文档对“具体请求字段名”的部分做了架构级抽象，没有假装给出未经验证的字段明细；等你确认要开始开发时，我建议下一步专门补一份“即梦 API 对接说明书”，把每个接口的请求参数、返回结构、错误码和示例请求逐项固化。
