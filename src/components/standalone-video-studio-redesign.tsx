"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, useTransition, KeyboardEvent, DragEvent } from "react";

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

type DraggedImage = {
  id: string;
  previewUrl: string;
  title: string;
  purpose: "start" | "end" | "reference";
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
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);

  // New state for redesigned UI
  const [localStartImage, setLocalStartImage] = useState<DraggedImage | null>(null);
  const [localEndImage, setLocalEndImage] = useState<DraggedImage | null>(null);
  const [localReferenceImages, setLocalReferenceImages] = useState<DraggedImage[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startFrameInputRef = useRef<HTMLInputElement>(null);
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const allJobs = [...pendingJobs, ...jobs];

  useEffect(() => {
    const hasProcessingJob = jobs.some((job) => job.status === "processing");
    if (hasProcessingJob) {
      const interval = setInterval(() => router.refresh(), 5000);
      return () => clearInterval(interval);
    }
  }, [jobs, router]);

  useEffect(() => {
    if (pendingJobs.length > 0) {
      setPendingJobs(prev => prev.filter(pj => !jobs.some(j => j.id === pj.id)));
    }
  }, [jobs, pendingJobs.length]);

  // Handle drag & drop for images
  const handleDragOver = (e: DragEvent, zone: string) => {
    e.preventDefault();
    setIsDraggingOver(zone);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(null);
  };

  const handleDrop = async (e: DragEvent, zone: "start" | "end" | "reference") => {
    e.preventDefault();
    setIsDraggingOver(null);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));

    if (files.length === 0) return;

    const file = files[0];
    await uploadImage(file, zone);
  };

  const uploadImage = async (file: File, zone: "start" | "end" | "reference") => {
    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);

      let endpoint = "/api/studio/reference";
      if (zone === "end") {
        endpoint = "/api/studio/reference-end";
      }

      const response = await fetch(endpoint, { method: "POST", body: formData });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "图片上传失败。");
        return;
      }

      setMessage(`${zone === "start" ? "首帧" : zone === "end" ? "尾帧" : "参考图"}已上传。`);
      router.refresh();
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, zone: "start" | "end") => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file, zone);
  };

  // Handle @ mentions in textarea
  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "@") {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const rect = textarea.getBoundingClientRect();
      const lineHeight = 24;
      const lines = textarea.value.substring(0, textarea.selectionStart).split("\n").length;

      setMentionPosition({
        top: rect.top - 200 + (lines * lineHeight),
        left: rect.left + 10
      });
      setCursorPosition(textarea.selectionStart + 1);
      setShowMentionMenu(true);
      setMentionFilter("");
    } else if (showMentionMenu) {
      if (e.key === "Escape") {
        setShowMentionMenu(false);
      } else if (e.key === " " || e.key === "Enter") {
        if (e.key === " ") {
          setShowMentionMenu(false);
        }
      }
    }
  };

  const handleTextareaChange = (value: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && cursorPos - lastAtIndex <= 20) {
      const filter = textBeforeCursor.substring(lastAtIndex + 1);
      if (!filter.includes(" ")) {
        setMentionFilter(filter);
        setShowMentionMenu(true);
      } else {
        setShowMentionMenu(false);
      }
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (imageTitle: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const beforeCursor = value.substring(0, cursorPosition - 1);
    const afterCursor = value.substring(cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    const newValue = beforeCursor.substring(0, lastAtIndex) + `@${imageTitle} ` + afterCursor;
    textarea.value = newValue;

    const newCursorPos = lastAtIndex + imageTitle.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    setShowMentionMenu(false);
  };

  const filteredImageAssets = imageAssets.filter(asset =>
    asset.title.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const prompt = payload.prompt as string;

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

      // Collect selected image IDs
      const selectedStartImageId = localStartImage?.id || (referenceImage ? "uploaded" : null);
      const selectedEndImageId = localEndImage?.id || (referenceEndImage ? "uploaded" : null);

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
        setPendingJobs(prev => prev.filter(j => j.id !== tempJob.id));
        return;
      }

      setMessage(data.message || "视频生成任务已提交，正在后台处理...");
      form.reset();
      router.refresh();
    });
  }

  const clearImage = async (type: "start" | "end") => {
    const endpoint = type === "start" ? "/api/studio/reference" : "/api/studio/reference-end";
    await fetch(endpoint, { method: "DELETE" });
    if (type === "start") {
      setLocalStartImage(null);
    } else {
      setLocalEndImage(null);
    }
    router.refresh();
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        .video-studio-redesign {
          --studio-bg: #0a0a0b;
          --studio-surface: #18181b;
          --studio-surface-elevated: #27272a;
          --studio-border: #3f3f46;
          --studio-text: #fafafa;
          --studio-text-muted: #a1a1aa;
          --studio-accent: #d97706;
          --studio-accent-soft: #f59e0b;
          --studio-accent-glow: rgba(217, 119, 6, 0.2);
          --studio-danger: #ef4444;
          --studio-success: #22c55e;

          font-family: 'IBM Plex Sans', sans-serif;
          background: var(--studio-bg);
          color: var(--studio-text);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .studio-header {
          padding: 24px 32px;
          border-bottom: 1px solid var(--studio-border);
          background: var(--studio-surface);
        }

        .studio-title {
          font-family: 'Crimson Pro', serif;
          font-size: 28px;
          font-weight: 600;
          margin: 0;
          background: linear-gradient(135deg, var(--studio-accent) 0%, var(--studio-accent-soft) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .studio-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .studio-history {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
          background: var(--studio-bg);
        }

        .studio-history::-webkit-scrollbar {
          width: 8px;
        }

        .studio-history::-webkit-scrollbar-track {
          background: transparent;
        }

        .studio-history::-webkit-scrollbar-thumb {
          background: var(--studio-surface-elevated);
          border-radius: 4px;
        }

        .history-item {
          margin-bottom: 24px;
          animation: slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .history-item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .status-pill {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-pill.processing {
          background: var(--studio-accent-glow);
          color: var(--studio-accent-soft);
        }

        .status-pill.success {
          background: rgba(34, 197, 94, 0.1);
          color: var(--studio-success);
        }

        .status-pill.error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--studio-danger);
        }

        .history-time {
          color: var(--studio-text-muted);
          font-size: 13px;
        }

        .history-content {
          background: var(--studio-surface);
          border: 1px solid var(--studio-border);
          border-radius: 12px;
          padding: 16px;
        }

        .video-result {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .video-result video {
          width: 240px;
          height: 135px;
          border-radius: 8px;
          object-fit: cover;
        }

        .video-info {
          flex: 1;
        }

        .video-title {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .video-prompt {
          color: var(--studio-text-muted);
          font-size: 14px;
          margin-bottom: 8px;
        }

        .studio-workspace {
          width: 520px;
          border-left: 1px solid var(--studio-border);
          background: var(--studio-surface);
          display: flex;
          flex-direction: column;
        }

        .workspace-section {
          padding: 24px;
          border-bottom: 1px solid var(--studio-border);
        }

        .workspace-section:last-child {
          border-bottom: none;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .section-title {
          font-family: 'Crimson Pro', serif;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--studio-text);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .frame-zones {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .drop-zone {
          aspect-ratio: 16/9;
          border: 2px dashed var(--studio-border);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          background: var(--studio-bg);
        }

        .drop-zone:hover {
          border-color: var(--studio-accent);
          background: var(--studio-surface-elevated);
        }

        .drop-zone.dragging-over {
          border-color: var(--studio-accent);
          background: var(--studio-accent-glow);
          transform: scale(1.02);
        }

        .drop-zone.has-image {
          border-style: solid;
          border-color: var(--studio-accent);
          padding: 0;
        }

        .drop-zone-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .drop-zone-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .drop-zone:hover .drop-zone-overlay {
          opacity: 1;
        }

        .drop-zone-label {
          position: absolute;
          bottom: 8px;
          left: 8px;
          padding: 4px 10px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--studio-accent-soft);
        }

        .drop-zone-icon {
          font-size: 32px;
          opacity: 0.5;
        }

        .drop-zone-text {
          font-size: 13px;
          color: var(--studio-text-muted);
          text-align: center;
        }

        .overlay-btn {
          padding: 6px 12px;
          background: var(--studio-surface);
          border: 1px solid var(--studio-border);
          border-radius: 6px;
          color: var(--studio-text);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .overlay-btn:hover {
          background: var(--studio-surface-elevated);
          border-color: var(--studio-accent);
        }

        .model-selector {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .model-chip {
          padding: 10px 16px;
          background: var(--studio-bg);
          border: 1px solid var(--studio-border);
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--studio-text-muted);
          flex: 1;
          min-width: 140px;
          text-align: center;
        }

        .model-chip:hover {
          border-color: var(--studio-accent);
          color: var(--studio-text);
        }

        .model-chip.active {
          background: var(--studio-accent-glow);
          border-color: var(--studio-accent);
          color: var(--studio-accent-soft);
          font-weight: 500;
        }

        .controls-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .control-label {
          font-size: 13px;
          color: var(--studio-text-muted);
          min-width: 60px;
        }

        .ratio-buttons {
          display: flex;
          gap: 6px;
        }

        .ratio-btn {
          padding: 6px 12px;
          background: var(--studio-bg);
          border: 1px solid var(--studio-border);
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--studio-text-muted);
        }

        .ratio-btn:hover {
          border-color: var(--studio-accent);
          color: var(--studio-text);
        }

        .ratio-btn.active {
          background: var(--studio-accent-glow);
          border-color: var(--studio-accent);
          color: var(--studio-accent-soft);
          font-weight: 500;
        }

        .duration-control {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .duration-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--studio-accent-soft);
          min-width: 40px;
        }

        .duration-slider {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--studio-border);
          outline: none;
          appearance: none;
        }

        .duration-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--studio-accent);
          cursor: pointer;
          box-shadow: 0 0 0 4px var(--studio-accent-glow);
          transition: all 0.2s;
        }

        .duration-slider::-webkit-slider-thumb:hover {
          background: var(--studio-accent-soft);
          transform: scale(1.1);
        }

        .prompt-container {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .prompt-textarea {
          flex: 1;
          background: var(--studio-bg);
          border: 1px solid var(--studio-border);
          border-radius: 12px;
          padding: 16px;
          color: var(--studio-text);
          font-size: 14px;
          font-family: 'IBM Plex Sans', sans-serif;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
        }

        .prompt-textarea:focus {
          border-color: var(--studio-accent);
        }

        .prompt-textarea::placeholder {
          color: var(--studio-text-muted);
        }

        .mention-menu {
          position: fixed;
          background: var(--studio-surface-elevated);
          border: 1px solid var(--studio-border);
          border-radius: 8px;
          padding: 6px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          min-width: 240px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .mention-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .mention-item:hover {
          background: var(--studio-accent-glow);
        }

        .mention-item-thumb {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
        }

        .mention-item-title {
          font-size: 13px;
          color: var(--studio-text);
        }

        .submit-section {
          padding: 16px 24px;
          border-top: 1px solid var(--studio-border);
          background: var(--studio-surface);
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--studio-accent) 0%, var(--studio-accent-soft) 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--studio-accent-glow);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-message {
          margin-top: 12px;
          padding: 12px;
          background: var(--studio-bg);
          border: 1px solid var(--studio-border);
          border-radius: 8px;
          font-size: 13px;
          text-align: center;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--studio-text-muted);
          font-size: 14px;
        }
      `}</style>

      <div className="video-studio-redesign">
        <div className="studio-header">
          <h1 className="studio-title">Video Studio</h1>
        </div>

        <div className="studio-layout">
          {/* History Panel */}
          <div className="studio-history">
            {assets.length > 0 || allJobs.length > 0 ? (
              [...allJobs.map(job => ({ type: 'job' as const, data: job, time: job.createdAt })),
                ...assets.map(asset => ({ type: 'asset' as const, data: asset, time: asset.createdAt }))]
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                .map((item) => {
                  if (item.type === 'job') {
                    const job = item.data;
                    return (
                      <div key={`job-${job.id}`} className="history-item">
                        <div className="history-item-header">
                          <span className={`status-pill ${job.status === 'processing' ? 'processing' : job.status === 'succeeded' ? 'success' : 'error'}`}>
                            {job.status === 'processing' ? '生成中' : job.status === 'succeeded' ? '已完成' : '失败'}
                          </span>
                          <span className="history-time">{new Date(job.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="history-content">
                          {job.name && <div style={{ fontWeight: 600, marginBottom: 8 }}>{job.name}</div>}
                          <div style={{ color: 'var(--studio-text-muted)', fontSize: 14 }}>{job.message}</div>
                        </div>
                      </div>
                    );
                  } else {
                    const asset = item.data;
                    return (
                      <div key={`asset-${asset.id}`} className="history-item">
                        <div className="history-item-header">
                          <span className="status-pill success">完成</span>
                          <span className="history-time">{new Date(asset.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="history-content">
                          <div className="video-result">
                            <video src={asset.previewUrl} controls />
                            <div className="video-info">
                              <div className="video-title">{asset.title}</div>
                              <div className="video-prompt">{asset.prompt}</div>
                              {asset.durationSec && <div style={{ fontSize: 13, color: 'var(--studio-text-muted)' }}>时长: {asset.durationSec}秒</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })
            ) : (
              <div className="empty-state">
                暂无生成历史，开始创作吧！
              </div>
            )}
          </div>

          {/* Workspace Panel */}
          <form className="studio-workspace" onSubmit={handleSubmit}>
            {/* Frame Selection */}
            <div className="workspace-section">
              <div className="section-title">帧控制</div>
              <div className="frame-zones">
                {/* Start Frame */}
                <input
                  ref={startFrameInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileInputChange(e, 'start')}
                />
                <div
                  className={`drop-zone ${isDraggingOver === 'start' ? 'dragging-over' : ''} ${referenceImage ? 'has-image' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'start')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'start')}
                  onClick={() => !referenceImage && startFrameInputRef.current?.click()}
                >
                  {referenceImage ? (
                    <>
                      <img src={referenceImage.previewUrl} alt="首帧" className="drop-zone-image" />
                      <div className="drop-zone-overlay">
                        <button type="button" className="overlay-btn" onClick={(e) => { e.stopPropagation(); clearImage('start'); }}>
                          删除
                        </button>
                      </div>
                      <div className="drop-zone-label">首帧</div>
                    </>
                  ) : (
                    <>
                      <div className="drop-zone-icon">🎬</div>
                      <div className="drop-zone-text">拖拽首帧<br/>或点击上传</div>
                    </>
                  )}
                </div>

                {/* End Frame */}
                <input
                  ref={endFrameInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileInputChange(e, 'end')}
                />
                <div
                  className={`drop-zone ${isDraggingOver === 'end' ? 'dragging-over' : ''} ${referenceEndImage ? 'has-image' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'end')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'end')}
                  onClick={() => !referenceEndImage && endFrameInputRef.current?.click()}
                >
                  {referenceEndImage ? (
                    <>
                      <img src={referenceEndImage.previewUrl} alt="尾帧" className="drop-zone-image" />
                      <div className="drop-zone-overlay">
                        <button type="button" className="overlay-btn" onClick={(e) => { e.stopPropagation(); clearImage('end'); }}>
                          删除
                        </button>
                      </div>
                      <div className="drop-zone-label">尾帧</div>
                    </>
                  ) : (
                    <>
                      <div className="drop-zone-icon">🎞️</div>
                      <div className="drop-zone-text">拖拽尾帧<br/>或点击上传</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div className="workspace-section">
              <div className="section-title">模型</div>
              <div className="model-selector">
                {videoModels.map((model) => (
                  <button
                    key={model.value}
                    type="button"
                    className={`model-chip ${selectedModel === model.value ? 'active' : ''}`}
                    onClick={() => setSelectedModel(model.value)}
                    title={model.description}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameters */}
            <div className="workspace-section">
              <div className="section-title">参数</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="controls-group">
                  <div className="control-label">比例</div>
                  <div className="ratio-buttons">
                    {aspectRatios.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        className={`ratio-btn ${selectedAspectRatio === ratio ? 'active' : ''}`}
                        onClick={() => setSelectedAspectRatio(ratio)}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="controls-group">
                  <div className="control-label">时长</div>
                  <div className="duration-control">
                    <input
                      type="range"
                      min="1"
                      max={selectedModel === "doubao-seedance-2-0-260128" ? "11" : "10"}
                      step="1"
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(Number(e.target.value))}
                      className="duration-slider"
                    />
                    <div className="duration-value">{selectedDuration}s</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="workspace-section">
              <div className="section-title">提示词</div>
              <div className="prompt-container">
                <textarea
                  ref={textareaRef}
                  name="prompt"
                  className="prompt-textarea"
                  placeholder="描述你想生成的视频... 输入 @ 引用图片"
                  required
                  onKeyDown={handleTextareaKeyDown}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                />

                {showMentionMenu && filteredImageAssets.length > 0 && (
                  <div className="mention-menu" style={{ top: mentionPosition.top, left: mentionPosition.left }}>
                    {filteredImageAssets.slice(0, 5).map((asset) => (
                      <div
                        key={asset.id}
                        className="mention-item"
                        onClick={() => insertMention(asset.title)}
                      >
                        <img src={asset.previewUrl} alt={asset.title} className="mention-item-thumb" />
                        <div className="mention-item-title">{asset.title}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="submit-section">
              <button type="submit" className="submit-btn" disabled={isPending}>
                {isPending ? '生成中...' : '生成视频'}
              </button>
              {message && <div className="status-message">{message}</div>}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
