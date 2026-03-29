"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { Shot } from "@/lib/project-store";

type GenerationPanelProps = {
  projectId: string;
  shot: Shot;
  defaultMode?: StudioMode;
  showModeTabs?: boolean;
  title?: string;
  description?: string;
};

type StudioMode = "image" | "video";

function getAspectSummary(aspectRatio: Shot["aspectRatio"]) {
  switch (aspectRatio) {
    case "16:9":
      return "16:9 · 高清 2K";
    case "1:1":
      return "1:1 · 标准封面";
    case "9:16":
    default:
      return "9:16 · 竖屏故事";
  }
}

export function GenerationPanel({
  projectId,
  shot,
  defaultMode = "image",
  showModeTabs = true,
  title,
  description
}: GenerationPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<StudioMode>(defaultMode);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const latestImageAsset = useMemo(() => shot.assets.find((asset) => asset.kind === "image") || null, [shot.assets]);
  const latestVideoAsset = useMemo(() => shot.assets.find((asset) => asset.kind === "video") || null, [shot.assets]);
  const latestImageJob = useMemo(() => shot.jobs.find((job) => job.kind === "image") || null, [shot.jobs]);
  const latestVideoJob = useMemo(() => shot.jobs.find((job) => job.kind === "video") || null, [shot.jobs]);
  const currentJob = mode === "image" ? latestImageJob : latestVideoJob;
  const currentAsset = mode === "image" ? latestImageAsset : latestVideoAsset;
  const currentAssets = shot.assets.filter((asset) => asset.kind === mode);
  const isWaiting = currentJob?.status === "queued" || currentJob?.status === "processing";

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (!isWaiting) {
      return;
    }

    const timer = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isWaiting, router]);

  function run(kind: StudioMode) {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/projects/${projectId}/shots/${shot.id}/generate-${kind}`, {
        method: "POST"
      });
      const data = (await response.json()) as { ok: boolean; message?: string; queued?: boolean };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "生成失败，请稍后再试。");
        return;
      }

      setMessage(
        kind === "image"
          ? data.queued
            ? "图片任务已入队，正在后台生成。"
            : "图片已生成。"
          : "视频入口已切换，当前仍以前置 MVP 流程为主。"
      );
      router.refresh();
    });
  }

  return (
    <section className="panel studio-panel">
      <div className="workspace-block-head">
        <div>
          <span className="pill">生成模块</span>
          <h2>{title || "先做图片，再切视频"}</h2>
          <p className="muted">{description || "按即梦的操作习惯把生成能力拆开。默认先走图片，视频通过顶部切换进入。"}</p>
        </div>
      </div>

      {showModeTabs ? (
        <div className="studio-tabs">
          <button className={`studio-tab ${mode === "image" ? "is-active" : ""}`} type="button" onClick={() => setMode("image")}>
            图片生成
          </button>
          <button className={`studio-tab ${mode === "video" ? "is-active" : ""}`} type="button" onClick={() => setMode("video")}>
            视频生成
          </button>
        </div>
      ) : null}

      {mode === "image" ? (
        <div className="studio-mode-card">
          <div className="studio-toolbar">
            <div className="studio-tool-chip is-primary">图片生成</div>
            <div className="studio-tool-chip">图片4.6</div>
            <div className="studio-tool-chip">{getAspectSummary(shot.aspectRatio)}</div>
          </div>

          <div className="studio-actions">
            <button className="btn btn-primary" type="button" disabled={isPending} onClick={() => run("image")}>
              {isPending ? "提交中..." : "开始生成图片"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setMode("video")}>
              切到视频
            </button>
          </div>

          <div className={`form-message ${message ? "success" : ""}`}>
            {message || (isWaiting ? "图片任务处理中，结果会自动刷新。" : "图片生成结果会优先展示在下面。")}
          </div>
        </div>
      ) : (
        <div className="studio-mode-card">
          <div className="studio-toolbar">
            <div className="studio-tool-chip is-primary">视频生成</div>
            <div className="studio-tool-chip">先复用当前分镜提示词</div>
            <div className="studio-tool-chip">建议先选好图片版本</div>
          </div>

          <div className="studio-actions">
            <button className="btn btn-primary" type="button" disabled={isPending} onClick={() => run("video")}>
              {isPending ? "提交中..." : "生成视频"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setMode("image")}>
              返回图片
            </button>
          </div>

          <div className={`form-message ${message ? "success" : ""}`}>
            {message || "视频模块先保留切换入口，等图片体验稳定后再继续强化。"}
          </div>
        </div>
      )}

      <div className="studio-result-panel">
        <div className="studio-result-head">
          <div>
            <span className="pill">{mode === "image" ? "图片结果" : "视频结果"}</span>
            <h3>{mode === "image" ? "当前图片输出" : "当前视频输出"}</h3>
          </div>
          <div className="studio-result-meta">
            <span>{currentAssets.length} 个结果</span>
            <span>{currentJob ? currentJob.status : "尚未生成"}</span>
          </div>
        </div>

        {currentAsset ? (
          <article className="studio-hero-result">
            <img className="result-preview" src={currentAsset.previewUrl} alt={currentAsset.title} />
            <div className="result-meta">
              <strong>{currentAsset.title}</strong>
              <span>
                {currentAsset.source === "jimeng" ? "即梦生成" : "Mock 结果"} · {new Date(currentAsset.createdAt).toLocaleString("zh-CN")}
              </span>
              {currentAsset.originalUrl ? (
                <a className="nav-link" href={currentAsset.originalUrl} target="_blank" rel="noreferrer">
                  查看即梦原图
                </a>
              ) : null}
              <a className="nav-link" href={currentAsset.previewUrl} target="_blank" rel="noreferrer">
                打开本地素材
              </a>
            </div>
          </article>
        ) : (
          <div className="studio-empty-result">
            <p className="muted">{mode === "image" ? "先生成第一张图，结果会显示在这里。" : "先切到视频并生成，结果会显示在这里。"}</p>
          </div>
        )}

        {currentAssets.length > 1 ? (
          <div className="studio-result-grid">
            {currentAssets.slice(1).map((asset) => (
              <article className="result-card" key={asset.id}>
                <img className="result-preview" src={asset.previewUrl} alt={asset.title} />
                <div className="result-meta">
                  <strong>{asset.title}</strong>
                  <small>{new Date(asset.createdAt).toLocaleString("zh-CN")}</small>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
