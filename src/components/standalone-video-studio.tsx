"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { Asset, Job } from "@/lib/project-store";
import type { StudioReferenceImage, StudioReferenceFile } from "@/lib/studio-store";

type StandaloneVideoStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
  imageAssets: Asset[];
  referenceFiles: StudioReferenceFile[];
};

const aspectRatios = ["16:9", "9:16", "1:1"] as const;
const videoModels = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Seeddance 1.5 Pro", description: "支持首尾帧" },
  { value: "doubao-seedance-2-0-260128", label: "Seedance 2.0", description: "多模态视频生成" },
  { value: "jimeng-video-2.0", label: "即梦视频 2.0", description: "仅支持首帧" }
] as const;

export function StandaloneVideoStudio({ assets, jobs, referenceImage, referenceEndImage, imageAssets, referenceFiles }: StandaloneVideoStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<typeof aspectRatios[number]>("16:9");
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [selectedModel, setSelectedModel] = useState<typeof videoModels[number]["value"]>("doubao-seedance-1-5-pro-251215");
  const [selectedStartImageId, setSelectedStartImageId] = useState<string | null>(null);
  const [selectedEndImageId, setSelectedEndImageId] = useState<string | null>(null);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [showMultimodal, setShowMultimodal] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileEndInputRef = useRef<HTMLInputElement | null>(null);
  const allJobs = [...pendingJobs, ...jobs];

  useEffect(() => {
    const hasProcessingJob = jobs.some((job) => job.status === "processing");
    if (hasProcessingJob) {
      const interval = setInterval(() => router.refresh(), 5000);
      return () => clearInterval(interval);
    }
  }, [jobs, router]);

  useEffect(() => {
    // 清理已经出现在真实 jobs 中的 pending jobs
    if (pendingJobs.length > 0) {
      setPendingJobs(prev => prev.filter(pj => !jobs.some(j => j.id === pj.id)));
    }
  }, [jobs, pendingJobs.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const prompt = payload.prompt as string;

    // 立即创建一个临时 job 显示在界面上
    const tempJob: Job = {
      id: `temp-${Date.now()}`,
      kind: "video",
      status: "processing",
      createdAt: new Date().toISOString(),
      message: prompt,
      name: `视频 #${jobs.filter(j => j.kind === 'video').length + pendingJobs.length + 1}`
    };
    setPendingJobs(prev => [tempJob, ...prev]);

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/studio/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        // 移除临时 job
        setPendingJobs(prev => prev.filter(j => j.id !== tempJob.id));
        return;
      }

      setMessage(data.message || "视频生成任务已提交，正在后台处理...");
      // 清空表单输入框
      form.reset();
      // 刷新页面数据
      router.refresh();
    });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/studio/reference", { method: "POST", body: formData });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "参考图上传失败。");
        return;
      }

      setMessage("参考图已上传。");
      router.refresh();
    });
  }

  return (
    <div className="chat-studio-container">
      {/* 历史记录区域 */}
      <div className="chat-history-area">
        {assets.length > 0 || allJobs.length > 0 ? (
          <div className="chat-messages">
            {[...allJobs.map(job => ({ type: 'job' as const, data: job, time: job.createdAt })),
              ...assets.map(asset => ({ type: 'asset' as const, data: asset, time: asset.createdAt }))]
              .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
              .map((item) => {
                if (item.type === 'job') {
                  const job = item.data;
                  return (
                    <div key={`job-${job.id}`} className="chat-message">
                      <div className="chat-message-status">
                        {job.status === 'processing' && <span className="status-badge processing">生成中</span>}
                        {job.status === 'succeeded' && <span className="status-badge success">已完成</span>}
                        {job.status === 'failed' && <span className="status-badge error">失败</span>}
                        <span className="chat-time">{new Date(job.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="chat-message-content">
                        {job.name && <div className="chat-job-name">{job.name}</div>}
                        <div className="chat-job-message">{job.message}</div>
                      </div>
                    </div>
                  );
                } else {
                  const asset = item.data;
                  return (
                    <div key={`asset-${asset.id}`} className="chat-message">
                      <div className="chat-message-status">
                        <span className="status-badge success">✓ 生成成功</span>
                        <span className="chat-time">{new Date(asset.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="chat-result-card">
                        <video src={asset.previewUrl} controls className="chat-result-video" />
                        <div className="chat-result-info">
                          <div className="chat-result-title">{asset.title}</div>
                          <div className="chat-result-prompt">{asset.prompt}</div>
                          {asset.durationSec && <div className="chat-result-meta">时长: {asset.durationSec}秒</div>}
                          {asset.originalUrl && (
                            <a href={asset.originalUrl} target="_blank" rel="noreferrer" className="chat-result-link">
                              查看原视频 →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
          </div>
        ) : (
          <div className="chat-empty">
            <p className="muted">暂无生成历史，开始创作吧！</p>
          </div>
        )}
      </div>

      {/* 输入区域 - 固定在底部 */}
      <form className="chat-input-area" onSubmit={handleSubmit}>
        <div className="chat-input-wrapper">
          {/* 参考图预览 */}
          {(referenceImage || selectedStartImageId || selectedEndImageId || (selectedModel === "doubao-seedance-2-0-260128" && referenceFiles.length > 0)) && (
            <div className="chat-references">
              {referenceImage && (
                <div className="chat-reference-preview">
                  <img src={referenceImage.previewUrl} alt="首帧" />
                  <div className="chat-reference-label">首帧</div>
                </div>
              )}
              {referenceEndImage && (
                <div className="chat-reference-preview">
                  <img src={referenceEndImage.previewUrl} alt="尾帧" />
                  <div className="chat-reference-label">尾帧</div>
                </div>
              )}
              {selectedStartImageId && (
                <div className="chat-reference-preview">
                  <img src={imageAssets.find(a => a.id === selectedStartImageId)?.previewUrl} alt="首帧" />
                  <div className="chat-reference-label">首帧</div>
                </div>
              )}
              {selectedEndImageId && (
                <div className="chat-reference-preview">
                  <img src={imageAssets.find(a => a.id === selectedEndImageId)?.previewUrl} alt="尾帧" />
                  <div className="chat-reference-label">尾帧</div>
                </div>
              )}
              {selectedModel === "doubao-seedance-2-0-260128" && referenceFiles.map(file => (
                <div key={file.id} className="chat-reference-preview">
                  {file.type === 'image' && <img src={file.previewUrl} alt={file.title} />}
                  {file.type === 'video' && <video src={file.previewUrl} />}
                  {file.type === 'audio' && <div className="audio-preview">🎵</div>}
                  <div className="chat-reference-label">{file.type}</div>
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-controls">
            {/* 工具栏 */}
            <div className="chat-toolbar">
              <button type="button" className="chat-tool-btn" onClick={() => setShowImageSelector(!showImageSelector)} title="选择参考图">
                🖼️
              </button>
              {selectedModel === "doubao-seedance-2-0-260128" && (
                <button type="button" className="chat-tool-btn" onClick={() => setShowMultimodal(!showMultimodal)} title="多模态参考">
                  📁
                </button>
              )}

              <div className="chat-model-select">
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

              <div className="chat-ratio-select">
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

              <div className="chat-duration-control">
                <span className="duration-label">{selectedDuration}秒</span>
                <input
                  type="range"
                  min="1"
                  max={selectedModel === "doubao-seedance-2-0-260128" ? "11" : "10"}
                  step="1"
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(Number(e.target.value))}
                  className="duration-slider"
                />
              </div>
            </div>

            {/* 图片选择器弹出 */}
            {showImageSelector && imageAssets.length > 0 && (
              <div className="chat-image-selector">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>选择参考图</span>
                  <button type="button" onClick={() => setShowImageSelector(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button type="button" className="studio-chip" onClick={() => { setSelectedStartImageId(null); setSelectedEndImageId(null); }}>
                    清除选择
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {imageAssets.slice(0, 12).map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        if (selectedStartImageId === asset.id) {
                          setSelectedStartImageId(null);
                        } else if (!selectedStartImageId) {
                          setSelectedStartImageId(asset.id);
                        } else if (selectedEndImageId === asset.id) {
                          setSelectedEndImageId(null);
                        } else {
                          setSelectedEndImageId(asset.id);
                        }
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: (selectedStartImageId === asset.id || selectedEndImageId === asset.id) ? '2px solid var(--accent)' : '1px solid var(--line)',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      <img src={asset.previewUrl} alt={asset.title} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                      {selectedStartImageId === asset.id && <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>首</div>}
                      {selectedEndImageId === asset.id && <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>尾</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 多模态文件选择器 */}
            {showMultimodal && selectedModel === "doubao-seedance-2-0-260128" && (
              <div className="chat-multimodal-selector">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>多模态参考 (图{referenceFiles.filter(f => f.type === 'image').length}/9 视{referenceFiles.filter(f => f.type === 'video').length}/3 音{referenceFiles.filter(f => f.type === 'audio').length}/3)</span>
                  <button type="button" onClick={() => setShowMultimodal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {referenceFiles.map((file) => (
                    <div key={file.id} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
                      {file.type === 'image' && <img src={file.previewUrl} alt={file.title} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />}
                      {file.type === 'video' && <video src={file.previewUrl} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />}
                      {file.type === 'audio' && <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>🎵</div>}
                      <button
                        type="button"
                        onClick={() => {
                          fetch(`/api/studio/reference-files?id=${file.id}`, { method: 'DELETE' })
                            .then(() => router.refresh())
                            .catch(console.error);
                        }}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.8)', border: 'none', color: 'white', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--line)', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        fetch('/api/studio/reference-files', { method: 'POST', body: formData })
                          .then(() => router.refresh())
                          .catch(console.error);
                      }}
                    />
                    <span style={{ fontSize: '24px' }}>+</span>
                  </label>
                </div>
              </div>
            )}

            {/* 提示信息 */}
            {selectedModel === "jimeng-video-2.0" && selectedEndImageId && (
              <div style={{ fontSize: '12px', color: 'var(--danger)', padding: '4px 0' }}>
                ⚠️ 即梦视频 2.0 不支持尾帧，将忽略尾帧设置
              </div>
            )}

            {/* 输入框和发送按钮 */}
            <div className="chat-input-row">
              <textarea
                id="prompt"
                name="prompt"
                rows={3}
                placeholder="描述你想生成的视频..."
                required
                className="chat-textarea"
              />
              <button className="chat-send-btn" type="submit" disabled={isPending}>
                {isPending ? "⏳" : "→"}
              </button>
            </div>
          </div>
        </div>

        {(message) && (
          <div className="chat-status-message">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
