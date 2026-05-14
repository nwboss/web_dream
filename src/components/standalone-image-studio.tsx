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
const imageModels = [
  { value: "jimeng-3.1", label: "即梦 3.1", description: "支持图生图" },
  { value: "doubao-seedream-4-5-251128", label: "Seedream 4.5", description: "高质量图片生成" }
] as const;

export function StandaloneImageStudio({ assets, jobs, referenceImage }: StandaloneImageStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<Shot["aspectRatio"]>("9:16");
  const [selectedModel, setSelectedModel] = useState<typeof imageModels[number]["value"]>("jimeng-3.1");
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

  useEffect(() => {
    // 如果有正在处理的任务，启动轮询
    const hasProcessingJob = jobs.some((job) => job.status === "processing");

    if (hasProcessingJob) {
      const interval = setInterval(() => {
        router.refresh();
      }, 5000); // 每5秒刷新一次

      return () => clearInterval(interval);
    }
  }, [jobs, router]);

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
          model: selectedModel
        })
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "图片生成失败，请稍后再试。");
        return;
      }

      setMessage(data.message || "图片生成任务已提交，正在后台处理...");
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
      <form className="panel studio-editor" onSubmit={handleSubmit}>
        <div className="studio-compose-grid is-single">
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

            <div style={{ marginBottom: '12px' }}>
              <label className="studio-label" style={{ display: 'block', marginBottom: '8px' }}>图片模型</label>
              <div className="studio-chip-group">
                {imageModels.map((model) => (
                  <button
                    key={model.value}
                    className={`studio-chip ${selectedModel === model.value ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedModel(model.value)}
                    title={model.description}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
              {selectedModel === "doubao-seedream-4-5-251128" && referenceImage && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--accent)' }}>
                  ℹ️ Seedream 4.5 不支持图生图，将忽略参考图
                </div>
              )}
            </div>

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
              <button className="btn btn-primary studio-submit-btn" type="submit" disabled={isPending}>
                {isPending ? "生成中..." : "生成图片"}
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
        <div className="section-header">
          <h3 className="section-title">生成历史</h3>
          <a href="/assets" className="link-accent">
            查看全部 →
          </a>
        </div>

        {assets.length > 0 ? (
          <div className="studio-result-grid-compact">
            {assets.slice(0, 6).map((asset) => (
              <div key={asset.id} className="result-card-compact">
                <img className="result-preview" src={asset.previewUrl} alt={asset.title} />
                <div className="result-card-overlay">
                  {asset.originalUrl && (
                    <a
                      className="result-link-btn"
                      href={asset.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      查看
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="studio-empty-result">
            <p className="muted">暂无生成结果</p>
          </div>
        )}
      </section>
    </div>
  );
}
