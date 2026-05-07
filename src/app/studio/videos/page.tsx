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
        <StudioModuleNav active="video" />
        <Link className="btn btn-ghost" href="/account">
          账户
        </Link>
      </div>

      <div className="panel workspace-module-shell">
        <StandaloneVideoStudio assets={state.videoAssets} jobs={state.videoJobs} />
      </div>
    </main>
  );
}
