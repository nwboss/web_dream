"use client";

import Link from "next/link";
import type { Route } from "next";

type StudioModuleNavProps = {
  active: "image" | "video" | "project";
  projectId?: string;
  shotId?: string | null;
};

export function StudioModuleNav({ active, projectId, shotId }: StudioModuleNavProps) {
  const projectHref = projectId ? `/projects/${projectId}${shotId ? `?shot=${shotId}&module=project` : "?module=project"}` : "/projects";

  return (
    <div className="workspace-module-tabs">
      <Link className={`workspace-module-tab ${active === "image" ? "is-active" : ""}`} href={"/studio/images" as Route}>
        图片生成
      </Link>
      <Link className={`workspace-module-tab ${active === "video" ? "is-active" : ""}`} href={"/studio/videos" as Route}>
        视频生成
      </Link>
      <Link className={`workspace-module-tab ${active === "project" ? "is-active" : ""}`} href={projectHref as Route}>
        漫剧项目
      </Link>
    </div>
  );
}
