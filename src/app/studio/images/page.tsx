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
          <h1 className="dashboard-title">图片生成</h1>
        </div>

        <div className="inline-actions">
          <Link className="btn btn-ghost" href="/account">
            账户中心
          </Link>
        </div>
      </div>

      <div className="panel workspace-module-shell">
        <div className="workspace-module-head">
          <div />
          <StudioModuleNav active="image" />
        </div>

        <StandaloneImageStudio assets={state.imageAssets} jobs={state.imageJobs} referenceImage={state.referenceImage} />
      </div>
    </main>
  );
}
