import Link from "next/link";

import { StandaloneVideoStudio } from "@/components/standalone-video-studio";
import { StudioModuleNav } from "@/components/studio-module-nav";
import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function VideoStudioPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

  return (
    <main className="shell workspace-layout">
      <div className="workspace-topbar">
        <div>
          <span className="pill">独立创作工作台</span>
          <h1 className="dashboard-title">视频生成</h1>
          <p className="muted">视频生成现在也是独立入口，不依赖项目。你可以先单独做片段，再挂入漫剧项目。</p>
        </div>

        <div className="inline-actions">
          <Link className="btn btn-secondary" href="/dashboard">
            返回控制台
          </Link>
          <Link className="btn btn-ghost" href="/account">
            账户中心
          </Link>
        </div>
      </div>

      <div className="panel workspace-module-shell">
        <div className="workspace-module-head">
          <div>
            <span className="pill">三模块工作台</span>
            <h2>独立视频生成页</h2>
          </div>
          <StudioModuleNav active="video" />
        </div>

        <StandaloneVideoStudio assets={state.videoAssets} jobs={state.videoJobs} />
      </div>
    </main>
  );
}
