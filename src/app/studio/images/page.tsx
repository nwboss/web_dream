import Link from "next/link";

import { StandaloneImageStudio } from "@/components/standalone-image-studio";
import { StudioModuleNav } from "@/components/studio-module-nav";
import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function ImageStudioPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

  return (
    <main className="shell workspace-layout">
      <div className="workspace-topbar">
        <div>
          <span className="pill">独立创作工作台</span>
          <h1 className="dashboard-title">图片生成</h1>
          <p className="muted">图片生成现在是独立入口，不依赖项目。你可以先单独出图，再决定是否纳入漫剧项目。</p>
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
            <h2>独立图片生成页</h2>
          </div>
          <StudioModuleNav active="image" />
        </div>

        <StandaloneImageStudio assets={state.imageAssets} jobs={state.imageJobs} referenceImage={state.referenceImage} />
      </div>
    </main>
  );
}
