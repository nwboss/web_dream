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
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingMultimodal, setIsDraggingMultimodal] = useState(false);
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileEndInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  // 拖拽处理函数
  const handleDragOver = (e: React.DragEvent, type: 'start' | 'end') => {
    e.preventDefault();
    if (type === 'start') {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  };

  const handleDragLeave = (type: 'start' | 'end') => {
    if (type === 'start') {
      setIsDraggingStart(false);
    } else {
      setIsDraggingEnd(false);
    }
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
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || `${type === 'start' ? '首帧' : '尾帧'}上传失败。`);
        return;
      }

      setMessage(`${type === 'start' ? '首帧' : '尾帧'}已上传。`);
      router.refresh();
    });
  };

  // @ 提及处理函数
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && e.key === 'Escape') {
      e.preventDefault();
      setShowMentionMenu(false);
    }
  };

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

        // 更新菜单位置 - 显示在输入框上方
        const rect = textarea.getBoundingClientRect();

        const position = {
          top: rect.top - 210, // 输入框上方210px
          left: rect.left + 10
        };
        setMentionPosition(position);
        setCursorPosition(cursorPos);
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
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    const newValue = textBeforeCursor.substring(0, lastAtIndex) + `@${imageTitle} ` + textAfterCursor;
    textarea.value = newValue;

    const newCursorPos = lastAtIndex + imageTitle.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    setShowMentionMenu(false);
  };

  // 根据模型构建可引用的文件列表
  const getMentionableFiles = () => {
    const files: Array<{ id: string; title: string; previewUrl: string; type?: string }> = [];

    if (selectedModel === "doubao-seedance-2-0-260128") {
      // Seeddance 2.0: 引用所有多模态文件
      referenceFiles.forEach((file, index) => {
        files.push({
          id: file.id,
          title: `${file.type === 'image' ? '图片' : file.type === 'video' ? '视频' : '音频'}${index + 1}`,
          previewUrl: file.previewUrl,
          type: file.type
        });
      });
    } else {
      // Seeddance 1.5 Pro / 即梦: 引用首尾帧
      if (referenceImage) {
        files.push({
          id: 'reference-start',
          title: '首帧',
          previewUrl: referenceImage.previewUrl
        });
      }
      if (referenceEndImage) {
        files.push({
          id: 'reference-end',
          title: '尾帧',
          previewUrl: referenceEndImage.previewUrl
        });
      }
    }

    return files;
  };

  const mentionableFiles = getMentionableFiles();
  const filteredImageAssets = mentionableFiles.filter(asset =>
    asset.title.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // 多模态文件拖拽处理
  const handleMultimodalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMultimodal(true);
  };

  const handleMultimodalDragLeave = () => {
    setIsDraggingMultimodal(false);
  };

  const handleMultimodalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMultimodal(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/')
    );

    if (files.length === 0) {
      setMessage("请拖入图片、视频或音频文件");
      return;
    }

    // 检查文件数量限制
    const imageCount = referenceFiles.filter(f => f.type === 'image').length;
    const videoCount = referenceFiles.filter(f => f.type === 'video').length;
    const audioCount = referenceFiles.filter(f => f.type === 'audio').length;

    for (const file of files) {
      let canUpload = false;

      if (file.type.startsWith('image/') && imageCount < 9) {
        canUpload = true;
      } else if (file.type.startsWith('video/') && videoCount < 3) {
        canUpload = true;
      } else if (file.type.startsWith('audio/') && audioCount < 3) {
        canUpload = true;
      }

      if (!canUpload) {
        setMessage(`文件数量已达上限（图${imageCount}/9，视${videoCount}/3，音${audioCount}/3）`);
        continue;
      }

      startTransition(async () => {
        setMessage("");
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/studio/reference-files', { method: 'POST', body: formData });
          const data = (await response.json()) as { ok: boolean; message?: string };

          if (!response.ok || !data.ok) {
            setMessage(data.message || `${file.name} 上传失败`);
            return;
          }

          setMessage(`${file.name} 已上传`);
          router.refresh();
        } catch (error) {
          setMessage(`${file.name} 上传失败`);
        }
      });
    }
  };

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
          {(referenceImage || referenceEndImage || selectedStartImageId || selectedEndImageId || (selectedModel === "doubao-seedance-2-0-260128" && referenceFiles.length > 0)) && (
            <div className="chat-references">
              {referenceImage && (
                <div
                  className="chat-reference-preview"
                  style={{ position: 'relative' }}
                  onDragOver={(e) => handleDragOver(e, 'start')}
                  onDragLeave={() => handleDragLeave('start')}
                  onDrop={(e) => handleDrop(e, 'start')}
                >
                  <img src={referenceImage.previewUrl} alt="首帧" style={{ opacity: isDraggingStart ? 0.5 : 1 }} />
                  <div className="chat-reference-label">首帧</div>
                  {isDraggingStart && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '2px dashed var(--accent)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      替换首帧
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      fetch("/api/studio/reference", { method: "DELETE" })
                        .then(() => router.refresh())
                        .catch(console.error);
                    }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.8)',
                      border: 'none',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {referenceEndImage && (
                <div
                  className="chat-reference-preview"
                  style={{ position: 'relative' }}
                  onDragOver={(e) => handleDragOver(e, 'end')}
                  onDragLeave={() => handleDragLeave('end')}
                  onDrop={(e) => handleDrop(e, 'end')}
                >
                  <img src={referenceEndImage.previewUrl} alt="尾帧" style={{ opacity: isDraggingEnd ? 0.5 : 1 }} />
                  <div className="chat-reference-label">尾帧</div>
                  {isDraggingEnd && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '2px dashed var(--accent)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      替换尾帧
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      fetch("/api/studio/reference-end", { method: "DELETE" })
                        .then(() => router.refresh())
                        .catch(console.error);
                    }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.8)',
                      border: 'none',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
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
              {selectedModel === "doubao-seedance-1-5-pro-251215" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                  />
                  <input
                    ref={fileEndInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;

                      startTransition(async () => {
                        setMessage("");
                        const formData = new FormData();
                        formData.append("file", file);
                        const response = await fetch("/api/studio/reference-end", { method: "POST", body: formData });
                        const data = (await response.json()) as { ok: boolean; message?: string };

                        if (!response.ok || !data.ok) {
                          setMessage(data.message || "尾帧上传失败。");
                          return;
                        }

                        setMessage("尾帧已上传。");
                        router.refresh();
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="chat-tool-btn"
                    onClick={() => setShowFrameSelector(!showFrameSelector)}
                    title="上传首尾帧（或拖拽图片到预览区域）"
                    style={{ position: 'relative' }}
                  >
                    🎬 首尾帧
                  </button>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    💡 拖拽图片或点击按钮
                  </div>
                </>
              )}
              {selectedModel === "doubao-seedance-2-0-260128" && (
                <>
                  <button type="button" className="chat-tool-btn" onClick={() => setShowMultimodal(!showMultimodal)} title="多模态参考（支持拖拽上传）">
                    📁
                  </button>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    💡 支持拖拽多个文件
                  </div>
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

            {/* 首尾帧上传选择器 */}
            {showFrameSelector && selectedModel === "doubao-seedance-1-5-pro-251215" && (
              <div className="chat-image-selector">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>上传首尾帧</span>
                  <button type="button" onClick={() => setShowFrameSelector(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowFrameSelector(false);
                    }}
                    style={{
                      padding: '32px 16px',
                      background: 'var(--bg-secondary)',
                      border: '2px dashed var(--line)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--panel-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                  >
                    <div style={{ fontSize: '32px' }}>🎬</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>上传首帧</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>视频的第一帧</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fileEndInputRef.current?.click();
                      setShowFrameSelector(false);
                    }}
                    style={{
                      padding: '32px 16px',
                      background: 'var(--bg-secondary)',
                      border: '2px dashed var(--line)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--panel-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                  >
                    <div style={{ fontSize: '32px' }}>🎞️</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>上传尾帧</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>视频的最后一帧</div>
                  </button>
                </div>
              </div>
            )}

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
              <div
                className="chat-multimodal-selector"
                onDragOver={handleMultimodalDragOver}
                onDragLeave={handleMultimodalDragLeave}
                onDrop={handleMultimodalDrop}
                style={{
                  position: 'relative',
                  border: isDraggingMultimodal ? '2px dashed var(--accent)' : undefined,
                  background: isDraggingMultimodal ? 'rgba(99, 102, 241, 0.05)' : undefined,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    多模态参考 (图{referenceFiles.filter(f => f.type === 'image').length}/9 视{referenceFiles.filter(f => f.type === 'video').length}/3 音{referenceFiles.filter(f => f.type === 'audio').length}/3)
                  </span>
                  <button type="button" onClick={() => setShowMultimodal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
                </div>

                {isDraggingMultimodal && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '2px dashed var(--accent)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}>
                    📎 拖放文件到这里
                  </div>
                )}

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
                  <label style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px', border: '2px dashed var(--line)', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;

                        Array.from(files).forEach(file => {
                          const formData = new FormData();
                          formData.append('file', file);
                          fetch('/api/studio/reference-files', { method: 'POST', body: formData })
                            .then(() => router.refresh())
                            .catch(console.error);
                        });
                      }}
                    />
                    <span style={{ fontSize: '24px' }}>+</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>点击或拖拽</span>
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
            {selectedModel === "doubao-seedance-1-5-pro-251215" && ((referenceImage && referenceEndImage) || (selectedStartImageId && selectedEndImageId)) && selectedDuration !== 5 && (
              <div style={{ fontSize: '12px', color: 'var(--warning)', padding: '4px 0' }}>
                ℹ️ Seeddance 1.5 Pro 首尾帧模式仅支持5秒时长，将自动调整为5秒
              </div>
            )}

            {/* 输入框和发送按钮 */}
            <div className="chat-input-row" style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                id="prompt"
                name="prompt"
                rows={3}
                placeholder="描述你想生成的视频... (输入 @ 可引用图片)"
                required
                className="chat-textarea"
                onKeyDown={handleTextareaKeyDown}
                onInput={handleTextareaInput}
              />
              <button className="chat-send-btn" type="submit" disabled={isPending}>
                {isPending ? "⏳" : "→"}
              </button>

              {/* @ 提及菜单 */}
              {showMentionMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0',
                  marginBottom: '8px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 10000,
                  minWidth: '260px',
                  padding: '4px'
                }}>
                  {filteredImageAssets.length > 0 ? (
                    filteredImageAssets.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => insertMention(asset.title)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          borderRadius: '6px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {asset.type === 'audio' ? (
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '4px',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                          }}>
                            🎵
                          </div>
                        ) : asset.type === 'video' ? (
                          <video
                            src={asset.previewUrl}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '4px',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <img
                            src={asset.previewUrl}
                            alt={asset.title}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '4px',
                              objectFit: 'cover'
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>{asset.title}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      暂无可引用的文件<br/>
                      <span style={{ fontSize: '11px' }}>
                        {selectedModel === "doubao-seedance-2-0-260128"
                          ? '请先上传多模态文件（图片/视频/音频）'
                          : '请先上传首帧或尾帧图片'}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
