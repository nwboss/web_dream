import { StandaloneImageStudio } from "@/components/standalone-image-studio";
import { StudioLayout } from "@/components/studio-layout";
import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function ImageStudioPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

  return (
    <StudioLayout>
      <div className="studio-content">
        <div className="studio-header">
          <h1 className="studio-title">图片生成</h1>
          <p className="studio-subtitle">使用 AI 快速生成高质量漫画风格图片</p>
        </div>
        <StandaloneImageStudio assets={state.imageAssets} jobs={state.imageJobs} referenceImage={state.referenceImage} />
      </div>
    </StudioLayout>
  );
}
