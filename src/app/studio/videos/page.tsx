import { StandaloneVideoStudio } from "@/components/standalone-video-studio";
import { StudioLayout } from "@/components/studio-layout";
import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function VideoStudioPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

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
        />
      </div>
    </StudioLayout>
  );
}
