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
        <StudioModuleNav active="image" />
        <Link className="btn btn-ghost" href="/account">
          账户
        </Link>
      </div>

      <div className="panel workspace-module-shell">
        <StandaloneImageStudio assets={state.imageAssets} jobs={state.imageJobs} referenceImage={state.referenceImage} />
      </div>
    </main>
  );
}
