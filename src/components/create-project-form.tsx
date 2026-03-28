"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

export function CreateProjectForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { ok: boolean; message?: string; redirectTo?: string };

      if (!response.ok || !data.ok || !data.redirectTo) {
        setMessage(data.message || "新建项目失败，请稍后再试。");
        return;
      }

      router.push(data.redirectTo as Route);
      router.refresh();
    });
  }

  return (
    <form className="dashboard-card" onSubmit={handleSubmit}>
      <h3>新建项目</h3>
      <p>先从一个项目标题、题材和故事 premise 开始，后面再进入分镜工作台细化。</p>

      <div className="field">
        <label htmlFor="title">项目标题</label>
        <input id="title" name="title" placeholder="例如：逆光重启 第 1 集" required />
      </div>

      <div className="field">
        <label htmlFor="genre">题材标签</label>
        <input id="genre" name="genre" placeholder="都市 / 校园 / 悬疑" required />
      </div>

      <div className="field">
        <label htmlFor="premise">故事简介</label>
        <textarea id="premise" name="premise" placeholder="一句话写清主角、冲突和情绪方向。" rows={4} required />
      </div>

      <div className="form-message error">{message}</div>
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending ? "创建中..." : "创建并进入工作台"}
      </button>
    </form>
  );
}
