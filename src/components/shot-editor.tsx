"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import type { Shot, ShotStatus } from "@/lib/project-store";

type ShotEditorProps = {
  projectId: string;
  shot: Shot;
};

const statuses: ShotStatus[] = ["draft", "ready", "generating", "done"];
const aspectRatios: Shot["aspectRatio"][] = ["9:16", "16:9", "1:1"];

export function ShotEditor({ projectId, shot }: ShotEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

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
    <form className="workspace-editor panel" onSubmit={handleSubmit}>
      <div className="workspace-block-head">
        <div>
          <span className="pill">当前分镜</span>
          <h2>{shot.title}</h2>
        </div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存分镜"}
        </button>
      </div>

      <div className="field">
        <label htmlFor="title">分镜标题</label>
        <input id="title" name="title" defaultValue={shot.title} required />
      </div>

      <div className="workspace-form-grid">
        <div className="field">
          <label htmlFor="status">状态</label>
          <select id="status" name="status" defaultValue={shot.status} className="select-field">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="aspectRatio">画幅</label>
          <select id="aspectRatio" name="aspectRatio" defaultValue={shot.aspectRatio} className="select-field">
            {aspectRatios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">分镜描述</label>
        <textarea id="description" name="description" defaultValue={shot.description} rows={6} required />
      </div>

      <div className="field">
        <label htmlFor="prompt">即梦生成提示词草稿</label>
        <textarea id="prompt" name="prompt" defaultValue={shot.prompt} rows={5} placeholder="先按主体 / 环境 / 镜头 / 情绪写出可生成 prompt。" />
      </div>

      <div className={`form-message ${message ? "success" : ""}`}>{message || `最后更新：${new Date(shot.updatedAt).toLocaleString("zh-CN")}`}</div>
    </form>
  );
}
