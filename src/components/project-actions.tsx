"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ProjectActionsProps = {
  projectId: string;
  sceneId: string;
};

export function ProjectActions({ projectId, sceneId }: ProjectActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  async function run(url: string) {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(url, { method: "POST" });
      const data = (await response.json()) as { ok: boolean; redirectTo?: string; message?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "操作失败，请稍后再试。");
        return;
      }

      if (data.redirectTo) {
        router.push(data.redirectTo as Route);
        router.refresh();
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <div className="inline-actions">
        <button className="btn btn-secondary" type="button" disabled={isPending} onClick={() => run(`/api/projects/${projectId}/scenes`)}>
          添加场次
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={isPending}
          onClick={() => run(`/api/projects/${projectId}/scenes/${sceneId}/shots`)}
        >
          添加分镜
        </button>
      </div>
      <div className={`form-message ${message ? "error" : ""}`}>{message}</div>
    </div>
  );
}
