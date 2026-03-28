"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { Shot } from "@/lib/project-store";

type GenerationPanelProps = {
  projectId: string;
  shot: Shot;
};

export function GenerationPanel({ projectId, shot }: GenerationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const latestAsset = shot.assets[0];
  const latestJob = shot.jobs[0];
  const isWaiting = latestJob?.status === "queued" || latestJob?.status === "processing";

  useEffect(() => {
    if (!isWaiting) {
      return;
    }

    const timer = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isWaiting, router]);

  function run(kind: "image" | "video") {
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
            ? "图片任务已入队，正在后台生成并保存到本地。"
            : "已生成新的图片候选。"
          : "已生成新的视频片段。"
      );
      router.refresh();
    });
  }

  return (
    <div className="asset-placeholder">
      <div className="asset-card">
        <span className="pill">最小生成 MVP</span>
        <h3>当前分镜生成面板</h3>
        <p>图片会优先走真实即梦 Provider，视频暂时仍为 mock 结果。每次成功后会把素材写回当前分镜。</p>
        <div className="job-list" style={{ marginTop: 16 }}>
          <div className="job-row">
            <strong>素材总数</strong>
            <span>{shot.assets.length} 个</span>
          </div>
          <div className="job-row">
            <strong>最近任务</strong>
            <span>{latestJob ? `${latestJob.message} · ${latestJob.status}` : "还没有生成记录"}</span>
          </div>
          <div className="job-row">
            <strong>最近素材</strong>
            <span>{latestAsset ? `${latestAsset.title} · ${latestAsset.source === "jimeng" ? "Jimeng" : "Mock"}` : "还没有素材"}</span>
          </div>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" type="button" disabled={isPending} onClick={() => run("image")}>
            {isPending ? "生成中..." : "生成图片"}
          </button>
          <button className="btn btn-secondary" type="button" disabled={isPending} onClick={() => run("video")}>
            {isPending ? "生成中..." : "生成视频"}
          </button>
        </div>
        <div className={`form-message ${message ? "success" : ""}`}>
          {message || (isWaiting ? "任务处理中，面板会自动刷新。" : "生成完成后会自动刷新当前分镜结果。")}
        </div>
      </div>

      <div className="asset-card">
        <span className="pill">任务记录</span>
        <h3>最近任务</h3>
        {shot.jobs.length ? (
          <div className="job-list">
            {shot.jobs.map((job) => (
              <div className="job-row" key={job.id}>
                <strong>{job.kind === "image" ? "图片任务" : "视频任务"}</strong>
                <span>{job.status}</span>
                <small>{new Date(job.createdAt).toLocaleString("zh-CN")}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">还没有发起生成任务。</p>
        )}
      </div>

      <div className="asset-card">
        <span className="pill">素材结果</span>
        <h3>当前分镜素材</h3>
        {latestAsset ? (
          <p className="muted">
            最近素材：{latestAsset.title} · {latestAsset.source === "jimeng" ? "Jimeng" : "Mock"} ·{" "}
            {new Date(latestAsset.createdAt).toLocaleString("zh-CN")}
          </p>
        ) : null}
        {shot.assets.length ? (
          <div className="asset-list">
            {shot.assets.map((asset) => (
              <article className="result-card" key={asset.id}>
                <img className="result-preview" src={asset.previewUrl} alt={asset.title} />
                <div className="result-meta">
                  <strong>{asset.title}</strong>
                  <span>
                    {asset.kind === "image" ? "图片素材" : `视频片段 · ${asset.durationSec || 0}s`} · {asset.source === "jimeng" ? "Jimeng" : "Mock"}
                  </span>
                  <small>{new Date(asset.createdAt).toLocaleString("zh-CN")}</small>
                  {asset.originalUrl ? (
                    <a className="nav-link" href={asset.originalUrl} target="_blank" rel="noreferrer">
                      查看即梦原图链接
                    </a>
                  ) : null}
                  <a className="nav-link" href={asset.previewUrl} target="_blank" rel="noreferrer">
                    打开本地素材
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">这里会展示这个分镜生成出来的图片和视频结果。</p>
        )}
      </div>
    </div>
  );
}
