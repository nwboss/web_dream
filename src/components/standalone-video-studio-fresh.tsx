"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { Asset, Job } from "@/lib/project-store";
import type { StudioReferenceImage, StudioReferenceFile } from "@/lib/studio-store";

type StandaloneVideoStudioProps = {
  assets: Asset[];
  jobs: Job[];
  referenceImage: StudioReferenceImage | null;
  referenceEndImage: StudioReferenceImage | null;
  imageAssets: Asset[];
  referenceFiles: StudioReferenceFile[];
  pendingRestore?: {
    prompt: string;
    aspectRatio?: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
    duration?: number;
    model?: string;
  };
  missingReferences?: boolean;
};

const aspectRatios = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
const videoModels = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Seeddance 1.5 Pro", description: "支持首尾帧" },
  { value: "doubao-seedance-2-0-260128", label: "Seedance 2.0", description: "多模态视频生成" },
  { value: "jimeng-video-2.0", label: "即梦视频 2.0", description: "仅支持首帧" }
] as const;

export function StandaloneVideoStudio({ assets, jobs, referenceImage, referenceEndImage, imageAssets, referenceFiles, pendingRestore, missingReferences }: StandaloneVideoStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<typeof aspectRatios[number]>(
    (aspectRatios as readonly string[]).includes(pendingRestore?.aspectRatio || "")
      ? (pendingRestore?.aspectRatio as typeof aspectRatios[number])
      : "16:9"
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(
    pendingRestore?.duration && pendingRestore.duration >= 1 ? pendingRestore.duration : 5
  );
  const [selectedModel, setSelectedModel] = useState<typeof videoModels[number]["value"]>(
    videoModels.some(m => m.value === pendingRestore?.model)
      ? (pendingRestore?.model as typeof videoModels[number]["value"])
      : "doubao-seedance-1-5-pro-251215"
  );
  const [restoredPrompt, setRestoredPrompt] = useState(pendingRestore?.prompt || "");
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingMultimodal, setIsDraggingMultimodal] = useState(false);
  const [isDraggingInput, setIsDraggingInput] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [orderedReferenceFiles, setOrderedReferenceFiles] = useState(referenceFiles);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrderedReferenceFiles(referenceFiles);
  }, [referenceFiles]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileEndInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const multimodalInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (pendingRestore) {
      setRestoredPrompt(pendingRestore.prompt);
      if ((aspectRatios as readonly string[]).includes(pendingRestore.aspectRatio || "")) {
        setSelectedAspectRatio(pendingRestore.aspectRatio as typeof aspectRatios[number]);
      }
      if (pendingRestore.duration && pendingRestore.duration >= 1) {
        setSelectedDuration(pendingRestore.duration);
      }
      if (videoModels.some(m => m.value === pendingRestore.model)) {
        setSelectedModel(pendingRestore.model as typeof videoModels[number]["value"]);
      }
      setMessage("已加载历史生成上下文，可直接修改后提交");
    }
  }, [pendingRestore]);

  useEffect(() => {
    if (missingReferences) {
      setMessage("部分历史参考资源已失效，请重新上传");
    }
  }, [missingReferences]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const prompt = payload.prompt as string;

    // 解析prompt中的@引用，提取被引用的文件ID
    const referencedFileIds: string[] = [];
    const mentionableFiles = getMentionableFiles();

    mentionableFiles.forEach(file => {
      // 检查prompt中是否包含 @文件名
      if (prompt.includes(`@${file.title}`)) {
        referencedFileIds.push(file.id);
      }
    });

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
          referencedFileIds: referencedFileIds.length > 0 ? referencedFileIds : undefined
        })
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "视频生成失败");
        setPendingJobs(prev => prev.filter(j => j.id !== tempJob.id));
        return;
      }

      setMessage(data.message || "视频生成中...");
      setRestoredPrompt("");
      router.refresh();
    });
  }

  // Drag handlers
  const handleDragOver = (e: React.DragEvent, type: 'start' | 'end') => {
    e.preventDefault();
    if (type === 'start') setIsDraggingStart(true);
    else setIsDraggingEnd(true);
  };

  const handleDragLeave = (type: 'start' | 'end') => {
    if (type === 'start') setIsDraggingStart(false);
    else setIsDraggingEnd(false);
  };

  const handleDrop = async (e: React.DragEvent, type: 'start' | 'end') => {
    e.preventDefault();
    setIsDraggingStart(false);
    setIsDraggingEnd(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const file = files[0];
    const endpoint = type === 'start' ? '/api/studio/reference' : '/api/studio/reference-end';

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (response.ok && data.ok) {
        setMessage(`${type === 'start' ? '首帧' : '尾帧'}已上传`);
        router.refresh();
      }
    });
  };

  // Multimodal drag handlers
  const handleMultimodalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMultimodal(true);
  };

  const handleMultimodalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMultimodal(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/')
    );

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      await fetch('/api/studio/reference-files', { method: 'POST', body: formData });
    }
    router.refresh();
  };

  function handleRestoreFromHistory(assetId: string) {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId })
      });
      const data = (await response.json()) as { ok: boolean; message?: string; missingReferences?: boolean };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "恢复失败");
        return;
      }

      if (data.missingReferences) {
        setMessage("部分历史参考资源已失效，请重新上传");
      }

      router.refresh();
    });
  }

  // Input area drag handlers
  const handleInputDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInput(true);
  };

  const handleInputDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInput(false);
  };

  const handleInputDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInput(false);

    const files = Array.from(e.dataTransfer.files);

    if (selectedModel === "doubao-seedance-2-0-260128") {
      // Seeddance 2.0: 支持多模态文件（图片/视频/音频）
      const validFiles = files.filter(f =>
        f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/')
      );

      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch('/api/studio/reference-files', { method: 'POST', body: formData });
      }
    } else {
      // Seeddance 1.5 Pro 或即梦视频 2.0: 只支持图片作为首帧
      const imageFiles = files.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        const formData = new FormData();
        formData.append('file', imageFiles[0]);
        await fetch('/api/studio/reference', { method: 'POST', body: formData });
      }
    }

    router.refresh();
  };

  // @ mention handlers
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && cursorPos - lastAtIndex <= 20) {
      const filter = textBeforeCursor.substring(lastAtIndex + 1);
      if (!filter.includes(' ') && !filter.includes('\n')) {
        setMentionFilter(filter);
        setShowMentionMenu(true);
      } else {
        setShowMentionMenu(false);
      }
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (title: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    const newValue = textBeforeCursor.substring(0, lastAtIndex) + `@${title} ` + value.substring(cursorPos);
    setRestoredPrompt(newValue);
    const newCursorPos = lastAtIndex + title.length + 2;

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.value = newValue;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);

    setShowMentionMenu(false);
  };

  const getMentionableFiles = () => {
    const files: Array<{ id: string; title: string; previewUrl: string; type?: string }> = [];

    if (selectedModel === "doubao-seedance-2-0-260128") {
      referenceFiles.forEach((file, index) => {
        files.push({
          id: file.id,
          title: `${file.type === 'image' ? '图片' : file.type === 'video' ? '视频' : '音频'}${index + 1}`,
          previewUrl: file.previewUrl,
          type: file.type
        });
      });
    } else {
      if (referenceImage) {
        files.push({ id: 'ref-start', title: '首帧', previewUrl: referenceImage.previewUrl });
      }
      if (referenceEndImage) {
        files.push({ id: 'ref-end', title: '尾帧', previewUrl: referenceEndImage.previewUrl });
      }
    }

    return files;
  };

  const mentionableFiles = getMentionableFiles();
  const filteredFiles = mentionableFiles.filter(f => f.title.toLowerCase().includes(mentionFilter.toLowerCase()));

  return (
    <div className="chat-studio-container">
      {/* 历史记录区域 - 可滚动 */}
      <div className="chat-history-area">
        {assets.length > 0 || allJobs.length > 0 ? (
          <div className="chat-messages">
            {[...allJobs.filter(job => job.status !== 'succeeded').map(job => ({ type: 'job' as const, data: job, time: job.createdAt })),
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
                          {asset.durationSec && <div className="chat-result-meta">时长: {asset.durationSec}s</div>}
                          <button
                            type="button"
                            className="chat-result-link"
                            onClick={() => handleRestoreFromHistory(asset.id)}
                            disabled={isPending}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: "6px" }}
                          >
                            修改重跑 →
                          </button>
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
      <form
        className="chat-input-area"
        onSubmit={handleSubmit}
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
        style={{
          transition: 'all 0.2s',
          ...(isDraggingInput ? {
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.1), var(--shadow-xl)',
            background: 'rgba(99, 102, 241, 0.02)'
          } : {})
        }}
      >
        {isDraggingInput && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 50
          }}>
            <div style={{
              padding: '24px 32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '48px' }}>📎</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                {selectedModel === "doubao-seedance-2-0-260128"
                  ? '拖放图片、视频或音频文件'
                  : '拖放图片文件'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {selectedModel === "doubao-seedance-2-0-260128"
                  ? '支持多个文件上传'
                  : '将作为首帧上传'}
              </div>
            </div>
          </div>
        )}

        <div className="chat-input-wrapper" style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          {/* 参考帧预览 - 左侧竖排 */}
          {(referenceImage || referenceEndImage || orderedReferenceFiles.length > 0) && (
            <div className="chat-references" style={{ flexShrink: 0, marginBottom: 0 }}>
              {referenceImage && (
                <div className="chat-reference-preview">
                  <img src={referenceImage.previewUrl} alt="首帧" />
                  <span className="chat-reference-label">首帧</span>
                  <span style={{ position: "absolute", bottom: "2px", left: "2px", right: "2px", fontSize: "11px", color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                    {referenceImage.title}
                  </span>
                  <button type="button" className="chat-reference-remove" onClick={() => {
                    fetch("/api/studio/reference", { method: "DELETE" }).then(() => router.refresh());
                  }}>×</button>
                </div>
              )}
              {referenceEndImage && (
                <div className="chat-reference-preview">
                  <img src={referenceEndImage.previewUrl} alt="尾帧" />
                  <span className="chat-reference-label">尾帧</span>
                  <span style={{ position: "absolute", bottom: "2px", left: "2px", right: "2px", fontSize: "11px", color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                    {referenceEndImage.title}
                  </span>
                  <button type="button" className="chat-reference-remove" onClick={() => {
                    fetch("/api/studio/reference-end", { method: "DELETE" }).then(() => router.refresh());
                  }}>×</button>
                </div>
              )}
              {orderedReferenceFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="chat-reference-preview"
                  draggable
                  onDragStart={() => setDraggingIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingIndex === null || draggingIndex === index) return;
                    const newOrder = [...orderedReferenceFiles];
                    const [moved] = newOrder.splice(draggingIndex, 1);
                    newOrder.splice(index, 0, moved);
                    setOrderedReferenceFiles(newOrder);
                    setDraggingIndex(null);
                    fetch("/api/studio/reference-files", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderedIds: newOrder.map(f => f.id) })
                    }).then(() => router.refresh()).catch(console.error);
                  }}
                  style={{
                    position: "relative",
                    cursor: "move",
                    opacity: draggingIndex === index ? 0.5 : 1
                  }}
                >
                  {file.type === 'image' && <img src={file.previewUrl} alt={file.title} />}
                  {file.type === 'video' && <video src={file.previewUrl} />}
                  {file.type === 'audio' && <div className="audio-preview">🎵</div>}
                  <span className="chat-reference-label">{file.type === 'image' ? '图片' : file.type === 'video' ? '视频' : '音频'}</span>
                  <button type="button" className="chat-reference-remove" onClick={() => {
                    fetch(`/api/studio/reference-files?id=${file.id}`, { method: 'DELETE' }).then(() => router.refresh());
                  }}>×</button>
                  <div style={{ padding: "4px 6px", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.title}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-controls" style={{ flex: 1, minWidth: 0 }}>
            {/* 输入框 - 上方 */}
            <div className="chat-input-row" style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                id="prompt"
                name="prompt"
                rows={3}
                placeholder="描述你想生成的视频... 输入 @ 可引用已上传的文件"
                required
                className="chat-textarea"
                value={restoredPrompt}
                onChange={(e) => setRestoredPrompt(e.target.value)}
                onInput={handleTextareaInput}
                onKeyDown={(e) => {
                  if (showMentionMenu && e.key === 'Escape') {
                    e.preventDefault();
                    setShowMentionMenu(false);
                  }
                }}
              />

              {showMentionMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '8px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  minWidth: '280px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  zIndex: 100
                }}>
                  {filteredFiles.length > 0 ? (
                    filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          background: 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(file.title);
                        }}
                      >
                        {file.type === 'audio' ? (
                          <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>🎵</div>
                        ) : file.type === 'video' ? (
                          <video src={file.previewUrl} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', background: 'var(--bg)', pointerEvents: 'none' }} />
                        ) : (
                          <img src={file.previewUrl} alt={file.title} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', background: 'var(--bg)', pointerEvents: 'none' }} />
                        )}
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', pointerEvents: 'none' }}>{file.title}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      暂无可引用的文件
                    </div>
                  )}
                </div>
              )}

              <button className="chat-send-btn" type="submit" disabled={isPending}>
                {isPending ? "⏳" : "→"}
              </button>
            </div>

            {/* 工具栏 - 下方 */}
            <div className="chat-toolbar">
              {/* 首尾帧上传 */}
              {selectedModel === "doubao-seedance-1-5-pro-251215" && (
                <>
                  <button type="button" className="chat-tool-btn" onClick={() => fileInputRef.current?.click()} title="上传首帧">
                    🎬
                  </button>
                  <input ref={fileInputRef} className="studio-hidden-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    fetch("/api/studio/reference", { method: "POST", body: formData }).then(() => router.refresh());
                  }} />
                  <button type="button" className="chat-tool-btn" onClick={() => fileEndInputRef.current?.click()} title="上传尾帧">
                    🎞️
                  </button>
                  <input ref={fileEndInputRef} className="studio-hidden-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    fetch("/api/studio/reference-end", { method: "POST", body: formData }).then(() => router.refresh());
                  }} />
                </>
              )}

              {/* 多模态上传 */}
              {selectedModel === "doubao-seedance-2-0-260128" && (
                <>
                  <button type="button" className="chat-tool-btn" onClick={() => multimodalInputRef.current?.click()} title="上传文件">
                    📎
                  </button>
                  <input ref={multimodalInputRef} type="file" accept="image/*,video/*,audio/*" multiple style={{ display: 'none' }} onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    Array.from(files).forEach(file => {
                      const formData = new FormData();
                      formData.append('file', file);
                      fetch('/api/studio/reference-files', { method: 'POST', body: formData });
                    });
                    setTimeout(() => router.refresh(), 500);
                  }} />
                </>
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
                <select
                  value={selectedAspectRatio}
                  onChange={(e) => setSelectedAspectRatio(e.target.value as typeof aspectRatios[number])}
                  style={{
                    padding: "4px 6px",
                    fontSize: "12px",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: "6px",
                    background: "white",
                    color: "var(--text)",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {aspectRatios.map((ratio) => (
                    <option key={ratio} value={ratio}>{ratio}</option>
                  ))}
                </select>
              </div>

              <div className="chat-duration-control">
                <input
                  type="number"
                  min="1"
                  max={selectedModel === "doubao-seedance-2-0-260128" ? 11 : 10}
                  step="1"
                  value={selectedDuration}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setSelectedDuration(v);
                  }}
                />
                <span>秒</span>
              </div>
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
