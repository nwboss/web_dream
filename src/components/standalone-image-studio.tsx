"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { Asset, Job, Shot } from "@/lib/project-store";
import type { StudioReferenceImage } from "@/lib/studio-store";

type StandaloneImageStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
};

const aspectRatios: Shot["aspectRatio"][] = ["9:16", "1:1", "16:9"];
const styles = [
  { value: "国漫", label: "国漫" },
  { value: "电影感", label: "电影" },
  { value: "细腻", label: "细腻" },
  { value: "悬疑", label: "悬疑" }
] as const;

export function StandaloneImageStudio({ assets, jobs, referenceImage }: StandaloneImageStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<Shot["aspectRatio"]>("9:16");
  const [selectedStyle, setSelectedStyle] = useState<(typeof styles)[number]["value"]>("国漫");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id || null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
  const latestJob = jobs[0];

  useEffect(() => {
    if (!assets.length) {
      setSelectedAssetId(null);
      return;
    }

    const stillExists = assets.some((asset) => asset.id === selectedAssetId);
    if (!stillExists) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/studio/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          aspectRatio: selectedAspectRatio,
          stylePreset: selectedStyle
        })
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "图片生成失败，请稍后再试。");
        return;
      }

      setMessage("独立图片生成完成。");
      router.refresh();
    });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/studio/reference", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "参考图上传失败。");
        return;
      }

      setMessage("参考图已上传。");
      router.refresh();
    });
  }

  function handleRemoveReference() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/studio/reference", {
        method: "DELETE"
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "参考图移除失败。");
        return;
      }

      setMessage("参考图已移除。");
      router.refresh();
    });
  }

  return (
    <div className="workspace-module-stack">
      <form className="workspace-editor panel studio-editor" onSubmit={handleSubmit}>
        <div className="studio-compose-grid">
          <div className="studio-reference-card">
            <div className="studio-reference-head">
              <span className="studio-label">参考图</span>
              {referenceImage ? (
                <div className="studio-reference-actions">
                  <button className="studio-mini-action" type="button" onClick={() => fileInputRef.current?.click()}>
                    替换
                  </button>
                  <button className="studio-mini-action is-danger" type="button" onClick={handleRemoveReference}>
                    移除
                  </button>
                </div>
              ) : null}
            </div>
            <button className="studio-reference-box studio-reference-button" type="button" onClick={() => fileInputRef.current?.click()}>
              {referenceImage ? <img src={referenceImage.previewUrl} alt={referenceImage.title} className="studio-reference-preview" /> : <span>+</span>}
            </button>
            <input ref={fileInputRef} className="studio-hidden-input" type="file" accept="image/*" onChange={handleUpload} />
            <p className="muted studio-file-name" title={referenceImage?.title}>
              {referenceImage ? referenceImage.title : "点击上传"}
            </p>
          </div>

          <div className="field studio-prompt-card">
            <textarea id="prompt" name="prompt" rows={6} placeholder="描述你想生成的图片..." required />
            <div className="studio-controls-row">
              <div className="studio-chip-group">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio}
                    className={`studio-chip ${selectedAspectRatio === ratio ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedAspectRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="studio-chip-group">
                {styles.map((style) => (
                  <button
                    key={style.value}
                    className={`studio-chip ${selectedStyle === style.value ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedStyle(style.value)}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary studio-submit-btn" type="submit" disabled={isPending}>
                {isPending ? "生成中..." : "生成"}
              </button>
            </div>
          </div>
        </div>

        {(message || latestJob?.message) && (
          <div className={`form-message ${message ? "success" : ""}`}>
            {message || latestJob.message}
          </div>
        )}
      </form>

      <section className="panel studio-panel">
        {latestAsset ? (
          <article className="studio-hero-result">
            <img className="result-preview" src={latestAsset.previewUrl} alt={latestAsset.title} />
            <div className="result-meta">
              <span className="muted">{new Date(latestAsset.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {latestAsset.originalUrl && (
                <a className="result-link" href={latestAsset.originalUrl} target="_blank" rel="noreferrer">
                  查看原图
                </a>
              )}
            </div>
          </article>
        ) : (
          <div className="studio-empty-result">
            <p className="muted">暂无结果</p>
          </div>
        )}

        {assets.length > 1 && (
          <div className="studio-result-grid">
            {assets.map((asset) => (
              <button
                className={`result-card ${latestAsset?.id === asset.id ? "is-active" : ""}`}
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <img className="result-preview" src={asset.previewUrl} alt={asset.title} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
