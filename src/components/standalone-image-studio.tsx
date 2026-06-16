"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { Asset, Job, Shot } from "@/lib/project-store";
import type { StudioReferenceImage } from "@/lib/studio-store";

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

const aspectRatios: Shot["aspectRatio"][] = ["9:16", "1:1", "16:9"];
const imageModels = [
  { value: "jimeng-3.1", label: "即梦 3.1", description: "支持图生图" },
  { value: "doubao-seedream-4-5-251128", label: "Seedream 4.5", description: "高质量图片生成" }
] as const;

export function StandaloneImageStudio({ assets, jobs, referenceImage, pendingRestore }: StandaloneImageStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<Shot["aspectRatio"]>(
    (aspectRatios as string[]).includes(pendingRestore?.aspectRatio || "")
      ? (pendingRestore?.aspectRatio as Shot["aspectRatio"])
      : "9:16"
  );
  const [selectedModel, setSelectedModel] = useState<typeof imageModels[number]["value"]>(
    imageModels.some(m => m.value === pendingRestore?.model)
      ? (pendingRestore?.model as typeof imageModels[number]["value"])
      : "jimeng-3.1"
  );
  const [restoredPrompt, setRestoredPrompt] = useState(pendingRestore?.prompt || "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id || null);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
  const latestJob = jobs[0];
  const allJobs = [...pendingJobs, ...jobs];

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

  useEffect(() => {
    // 清理已经出现在真实 jobs 中的 pending jobs
    if (pendingJobs.length > 0) {
      setPendingJobs(prev => prev.filter(pj => !jobs.some(j => j.id === pj.id)));
    }
  }, [jobs, pendingJobs.length]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const prompt = payload.prompt as string;

    // 立即创建一个临时 job 显示在界面上
    const tempJob: Job = {
      id: `temp-${Date.now()}`,
      kind: "image",
      status: "processing",
      createdAt: new Date().toISOString(),
      message: prompt,
      name: `图片 #${jobs.filter(j => j.kind === 'image').length + pendingJobs.length + 1}`
    };
    setPendingJobs(prev => [tempJob, ...prev]);

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
        // 移除临时 job
        setPendingJobs(prev => prev.filter(j => j.id !== tempJob.id));
        return;
      }

      setMessage(data.message || "图片生成任务已提交，正在后台处理...");
      setRestoredPrompt("");
      // 刷新页面数据
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
    <div className="chat-studio-container">
      {/* 历史记录区域 - 可滚动 */}
      <div className="chat-history-area">
        {assets.length > 0 || allJobs.length > 0 ? (
          <div className="chat-messages">
            {/* 显示所有任务和资源，按时间排序 */}
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
                        <img src={asset.previewUrl} alt={asset.title} className="chat-result-image" />
                        <div className="chat-result-info">
                          <div className="chat-result-title">{asset.title}</div>
                          <div className="chat-result-prompt">{asset.prompt}</div>
                          {asset.originalUrl && (
                            <a href={asset.originalUrl} target="_blank" rel="noreferrer" className="chat-result-link">
                              查看原图 →
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
          {/* 参考图 */}
          {referenceImage && (
            <div className="chat-reference-preview">
              <img src={referenceImage.previewUrl} alt={referenceImage.title} />
              <button type="button" className="chat-reference-remove" onClick={handleRemoveReference}>×</button>
              <span style={{ position: "absolute", bottom: "2px", left: "2px", right: "2px", fontSize: "11px", color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                {referenceImage.title}
              </span>
            </div>
          )}

          <div className="chat-input-controls">
            {/* 工具栏 */}
            <div className="chat-toolbar">
              <button type="button" className="chat-tool-btn" onClick={() => fileInputRef.current?.click()} title="上传参考图">
                📎
              </button>
              <input ref={fileInputRef} className="studio-hidden-input" type="file" accept="image/*" onChange={handleUpload} />

              <div className="chat-model-select">
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
            </div>

            {/* 提示信息 */}
            {selectedModel === "doubao-seedream-4-5-251128" && referenceImage && (
              <div style={{ fontSize: '12px', color: 'var(--accent)', padding: '4px 0' }}>
                ℹ️ Seedream 4.5 不支持图生图，将忽略参考图
              </div>
            )}

            {/* 输入框和发送按钮 */}
            <div className="chat-input-row">
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
              <button className="chat-send-btn" type="submit" disabled={isPending}>
                {isPending ? "⏳" : "→"}
              </button>
            </div>
          </div>
        </div>

        {(message || latestJob?.message) && (
          <div className="chat-status-message">
            {message || latestJob.message}
          </div>
        )}
      </form>
    </div>
  );
}
