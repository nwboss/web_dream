"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import type { Shot, ShotStatus } from "@/lib/project-store";

type ShotEditorProps = {
  projectId: string;
  shot: Shot;
  variant?: "image" | "project" | "video";
};

const statuses: ShotStatus[] = ["draft", "ready", "generating", "done"];
const aspectRatios: Shot["aspectRatio"][] = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];

function getResolutionLabel(aspectRatio: Shot["aspectRatio"]) {
  switch (aspectRatio) {
    case "21:9":
      return "1848 × 792 / 超宽";
    case "16:9":
      return "1664 × 936 / 高清 2K";
    case "4:3":
      return "1328 × 996 / 经典 4:3";
    case "1:1":
      return "1328 × 1328 / 标清 1K";
    case "3:4":
      return "996 × 1328 / 竖屏 3:4";
    case "9:16":
    default:
      return "936 × 1664 / 竖屏故事";
  }
}

export function ShotEditor({ projectId, shot, variant = "image" }: ShotEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [aspectRatio, setAspectRatio] = useState<Shot["aspectRatio"]>(shot.aspectRatio);
  const isProjectMode = variant === "project";
  const isVideoMode = variant === "video";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/projects/${projectId}/shots/${shot.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "保存失败，请稍后再试。");
        return;
      }

      setMessage("分镜已保存。");
      router.refresh();
    });
  }

  return (
    <form className={`workspace-editor panel studio-editor ${isProjectMode ? "project-editor" : ""}`} onSubmit={handleSubmit}>
      <div className="workspace-block-head">
        <div>
          <span className="pill">{isProjectMode ? "当前分镜" : isVideoMode ? "视频输入区" : "图片创作台"}</span>
          <h2>
            {isProjectMode ? "编辑当前分镜内容" : isVideoMode ? "先准备这一镜的视频输入信息" : "先把这一镜的图片输入准备好"}
          </h2>
          <p className="muted">
            {isProjectMode
              ? "这里负责项目驱动的分镜编辑，生成结果和版本会在右侧统一管理。"
              : isVideoMode
                ? "视频模块先复用当前分镜文本和画幅设置，后面再增强镜头参数。"
                : "参考即梦的简洁生成面板，先把图片主流程做顺，再点击切换视频。"}
          </p>
        </div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "保存中..." : isProjectMode ? "保存分镜" : "保存设置"}
        </button>
      </div>

      <div className="studio-module-grid">
        <div className="field studio-field-card">
          <label htmlFor="title">分镜标题</label>
          <input id="title" name="title" defaultValue={shot.title} required />
        </div>

        <div className="field studio-field-card">
          <label htmlFor="status">当前状态</label>
          <select id="status" name="status" defaultValue={shot.status} className="select-field">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="field studio-field-card">
          <label htmlFor="aspectRatio">尺寸与分辨率</label>
          <select
            id="aspectRatio"
            name="aspectRatio"
            value={aspectRatio}
            onChange={(event) => setAspectRatio(event.target.value as Shot["aspectRatio"])}
            className="select-field"
          >
            {aspectRatios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
          <small className="muted">{getResolutionLabel(aspectRatio)}</small>
        </div>
      </div>

      <div className="studio-compose-grid">
        {!isProjectMode ? (
          <div className="studio-reference-card">
            <span className="studio-label">{isVideoMode ? "首帧 / 参考图" : "参考图"}</span>
            <div className="studio-reference-box">
              <span>+</span>
            </div>
            <p className="muted">{isVideoMode ? "先留视频首帧输入位，下一步再接真实上传。" : "先留上传位，下一步再接图生图和参考图上传。"}</p>
          </div>
        ) : null}

        <div className={`field studio-prompt-card ${isProjectMode ? "is-full" : ""}`}>
          <label htmlFor="prompt">{isProjectMode ? "提示词草稿" : "提示词"}</label>
          <textarea
            id="prompt"
            name="prompt"
            defaultValue={shot.prompt}
            rows={6}
            placeholder={
              isProjectMode
                ? "按主体、场景、镜头、情绪整理这镜的提示词草稿。"
                : isVideoMode
                  ? "描述视频镜头的动作、运镜和情绪。"
                  : "上传参考图，输入文字，描述你想生成的图片。先写主体、场景、镜头、风格和情绪。"
            }
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">补充分镜说明</label>
        <textarea id="description" name="description" defaultValue={shot.description} rows={4} required placeholder="给这镜补充角色关系、动作、情绪和剧情上下文。" />
      </div>

      <div className={`form-message ${message ? "success" : ""}`}>{message || `最后更新：${new Date(shot.updatedAt).toLocaleString("zh-CN")}`}</div>
    </form>
  );
}
