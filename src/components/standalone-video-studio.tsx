"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import type { Asset, Job } from "@/lib/project-store";

type StandaloneVideoStudioProps = {
  assets: Asset[];
  jobs: Job[];
};

export function StandaloneVideoStudio({ assets, jobs }: StandaloneVideoStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const latestAsset = assets[0];
  const latestJob = jobs[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/studio/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "视频生成失败，请稍后再试。");
        return;
      }

      setMessage("独立视频结果已更新。");
      router.refresh();
    });
  }

  return (
    <div className="workspace-module-stack">
      <form className="workspace-editor panel studio-editor" onSubmit={handleSubmit}>
        <div className="workspace-block-head">
          <div>
            <span className="pill">独立视频生成</span>
            <h2>这里不依赖项目，直接出视频片段</h2>
            <p className="muted">视频功能也单独拿出来。后面可以从独立图片模块带图过来，但入口本身不依赖项目。</p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            {isPending ? "生成中..." : "生成视频"}
          </button>
        </div>

        <div className="studio-module-grid">
          <div className="field studio-field-card">
            <label htmlFor="mode">模式</label>
            <select id="mode" className="select-field" defaultValue="text2video" disabled>
              <option value="text2video">文生视频</option>
            </select>
          </div>

          <div className="field studio-field-card">
            <label htmlFor="duration">时长</label>
            <select id="duration" className="select-field" defaultValue="5" disabled>
              <option value="5">5 秒</option>
            </select>
          </div>

          <div className="field studio-field-card">
            <label htmlFor="quality">清晰度</label>
            <select id="quality" className="select-field" defaultValue="720p" disabled>
              <option value="720p">720P</option>
            </select>
          </div>
        </div>

        <div className="studio-compose-grid">
          <div className="studio-reference-card">
            <span className="studio-label">首帧 / 参考图</span>
            <div className="studio-reference-box">
              <span>+</span>
            </div>
            <p className="muted">后续可从独立图片模块带入，也可上传首帧图。</p>
          </div>

          <div className="field studio-prompt-card">
            <label htmlFor="prompt">提示词</label>
            <textarea id="prompt" name="prompt" rows={6} placeholder="描述你想生成的视频镜头、动作和情绪。" required />
          </div>
        </div>

        <div className={`form-message ${message ? "success" : ""}`}>
          {message || (latestJob ? `最近任务：${latestJob.message}` : "先生成第一条独立视频片段。")}
        </div>
      </form>

      <section className="panel studio-panel">
        <div className="workspace-block-head">
          <div>
            <span className="pill">视频结果</span>
            <h2>独立视频结果区</h2>
          </div>
        </div>

        {latestAsset ? (
          <article className="studio-hero-result">
            <img className="result-preview" src={latestAsset.previewUrl} alt={latestAsset.title} />
            <div className="result-meta">
              <strong>{latestAsset.title}</strong>
              <span>{latestAsset.source === "jimeng" ? "即梦生成" : "Mock"} · {new Date(latestAsset.createdAt).toLocaleString("zh-CN")}</span>
              <a className="nav-link" href={latestAsset.previewUrl} target="_blank" rel="noreferrer">
                打开结果
              </a>
            </div>
          </article>
        ) : (
          <div className="studio-empty-result">
            <p className="muted">这里会展示独立视频生成结果。</p>
          </div>
        )}
      </section>
    </div>
  );
}
