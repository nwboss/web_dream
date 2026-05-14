"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { Asset, Job } from "@/lib/project-store";
import type { StudioReferenceImage } from "@/lib/studio-store";

type StandaloneVideoStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
  imageAssets: Asset[];
};

const aspectRatios = ["16:9", "9:16", "1:1"] as const;
const videoModels = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Seeddance 1.5 Pro", description: "支持首尾帧" },
  { value: "jimeng-video-2.0", label: "即梦视频 2.0", description: "仅支持首帧" }
] as const;

export function StandaloneVideoStudio({ assets, jobs, referenceImage, referenceEndImage, imageAssets }: StandaloneVideoStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id || null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<typeof aspectRatios[number]>("16:9");
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [selectedModel, setSelectedModel] = useState<typeof videoModels[number]["value"]>("doubao-seedance-1-5-pro-251215");
  const [selectedStartImageId, setSelectedStartImageId] = useState<string | null>(null);
  const [selectedEndImageId, setSelectedEndImageId] = useState<string | null>(null);
  const [imageSelectMode, setImageSelectMode] = useState<"start" | "end">("start");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileEndInputRef = useRef<HTMLInputElement | null>(null);
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
      const response = await fetch("/api/studio/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          aspectRatio: selectedAspectRatio,
          duration: selectedDuration,
          model: selectedModel,
          selectedStartImageId,
          selectedEndImageId
        })
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "视频生成失败，请稍后再试。");
        return;
      }

      setMessage(data.message || "视频生成任务已提交，正在后台处理...");
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

      setMessage("首帧参考图已移除。");
      router.refresh();
    });
  }

  function handleUploadEnd(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/studio/reference-end", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "尾帧参考图上传失败。");
        return;
      }

      setMessage("尾帧参考图已上传。");
      router.refresh();
    });
  }

  function handleRemoveReferenceEnd() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/studio/reference-end", {
        method: "DELETE"
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "尾帧参考图移除失败。");
        return;
      }

      setMessage("尾帧参考图已移除。");
      router.refresh();
    });
  }

  return (
    <div className="workspace-module-stack">
      <form className="workspace-editor panel studio-editor" onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 150px", gap: "16px" }}>
            <div className="studio-reference-card">
              <div className="studio-reference-head">
                <span className="studio-label">首帧</span>
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

            <div className="studio-reference-card">
              <div className="studio-reference-head">
                <span className="studio-label">尾帧（可选）</span>
                {referenceEndImage ? (
                  <div className="studio-reference-actions">
                    <button className="studio-mini-action" type="button" onClick={() => fileEndInputRef.current?.click()}>
                      替换
                    </button>
                    <button className="studio-mini-action is-danger" type="button" onClick={handleRemoveReferenceEnd}>
                      移除
                    </button>
                  </div>
                ) : null}
              </div>
              <button className="studio-reference-box studio-reference-button" type="button" onClick={() => fileEndInputRef.current?.click()}>
                {referenceEndImage ? <img src={referenceEndImage.previewUrl} alt={referenceEndImage.title} className="studio-reference-preview" /> : <span>+</span>}
              </button>
              <input ref={fileEndInputRef} className="studio-hidden-input" type="file" accept="image/*" onChange={handleUploadEnd} />
              <p className="muted studio-file-name" title={referenceEndImage?.title}>
                {referenceEndImage ? referenceEndImage.title : "点击上传"}
              </p>
            </div>
          </div>

          {imageAssets.length > 0 && (
            <div>
              <div className="section-header" style={{ marginBottom: '12px' }}>
                <span className="studio-label">或从已生成图片中选择</span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="studio-chip-group">
                    <button
                      type="button"
                      className={`studio-chip ${imageSelectMode === 'start' ? 'is-active' : ''}`}
                      onClick={() => setImageSelectMode('start')}
                    >
                      首帧
                    </button>
                    <button
                      type="button"
                      className={`studio-chip ${imageSelectMode === 'end' ? 'is-active' : ''}`}
                      onClick={() => setImageSelectMode('end')}
                    >
                      尾帧
                    </button>
                  </div>
                  <a href="/assets" className="link-accent" style={{ fontSize: '13px' }}>
                    查看全部 →
                  </a>
                </div>
              </div>
              <div className="image-select-grid">
                {imageAssets.slice(0, 8).map((asset) => {
                  const isSelected = imageSelectMode === 'start'
                    ? selectedStartImageId === asset.id
                    : selectedEndImageId === asset.id;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`image-select-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (imageSelectMode === 'start') {
                          setSelectedStartImageId(isSelected ? null : asset.id);
                        } else {
                          setSelectedEndImageId(isSelected ? null : asset.id);
                        }
                      }}
                    >
                      <img src={asset.previewUrl} alt={asset.title} />
                      {isSelected && (
                        <div className="image-select-badge">
                          {imageSelectMode === 'start' ? '首' : '尾'}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {(selectedStartImageId || selectedEndImageId) && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                  {selectedStartImageId && <span>✓ 已选首帧</span>}
                  {selectedStartImageId && selectedEndImageId && <span> · </span>}
                  {selectedEndImageId && <span>✓ 已选尾帧</span>}
                </div>
              )}
            </div>
          )}

          <div className="field studio-prompt-card">
            <textarea id="prompt" name="prompt" rows={4} placeholder="描述你想生成的视频..." required />

            <div style={{ marginBottom: '12px' }}>
              <label className="studio-label" style={{ display: 'block', marginBottom: '8px' }}>视频模型</label>
              <div className="studio-chip-group">
                {videoModels.map((model) => (
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
              {selectedModel === "jimeng-video-2.0" && selectedEndImageId && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                  ⚠️ 即梦视频 2.0 不支持尾帧，将忽略尾帧设置
                </div>
              )}
              {selectedModel === "doubao-seedance-1-5-pro-251215" &&
               ((selectedStartImageId && selectedEndImageId) || (referenceImage && referenceEndImage)) && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--accent)' }}>
                  ℹ️ 首尾帧模式下，时长固定为5秒
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, maxWidth: "300px" }}>
                <label htmlFor="duration-slider" style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)", minWidth: "60px" }}>
                  时长: {selectedDuration}秒
                </label>
                <input
                  id="duration-slider"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(Number(e.target.value))}
                  style={{
                    flex: 1,
                    height: "6px",
                    borderRadius: "3px",
                    background: `linear-gradient(to right, rgba(255, 209, 102, 0.6) 0%, rgba(255, 209, 102, 0.6) ${(selectedDuration - 1) * 11.11}%, rgba(255, 255, 255, 0.1) ${(selectedDuration - 1) * 11.11}%, rgba(255, 255, 255, 0.1) 100%)`,
                    outline: "none",
                    cursor: "pointer"
                  }}
                />
              </div>
              <button className="btn btn-primary studio-submit-btn" type="submit" disabled={isPending}>
                {isPending ? "生成中..." : "生成视频"}
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
                {asset.kind === "video" ? (
                  <video className="result-preview" src={asset.previewUrl} />
                ) : (
                  <img className="result-preview" src={asset.previewUrl} alt={asset.title} />
                )}
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
