import { StandaloneVideoStudio } from "@/components/standalone-video-studio-fresh";
import { StudioLayout } from "@/components/studio-layout";
import { requireSession } from "@/lib/session";
import { getStudioState, takePendingRestore } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function VideoStudioPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const missingReferences = params.missingReferences === "1";
  const state = await getStudioState(session.email);
  const pendingRestore = await takePendingRestore(session.email);

  return (
    <StudioLayout>
      <div className="studio-content">
        <div className="studio-header">
          <h1 className="studio-title">视频生成</h1>
          <p className="studio-subtitle">将图片转换为动态视频内容</p>
        </div>
        <StandaloneVideoStudio
          assets={state.videoAssets}
          jobs={state.videoJobs}
          referenceImage={state.referenceImage}
          referenceEndImage={state.referenceEndImage}
          imageAssets={state.imageAssets}
          referenceFiles={state.referenceFiles}
          pendingRestore={pendingRestore || undefined}
          missingReferences={missingReferences}
        />
      </div>
    </StudioLayout>
  );
}
