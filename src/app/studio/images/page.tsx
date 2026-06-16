import { StandaloneImageStudio } from "@/components/standalone-image-studio";
import { StudioLayout } from "@/components/studio-layout";
import { requireSession } from "@/lib/session";
import { getStudioState, takePendingRestore } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function ImageStudioPage({
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
          <h1 className="studio-title">图片生成</h1>
          <p className="studio-subtitle">使用 AI 快速生成高质量漫画风格图片</p>
        </div>
        <StandaloneImageStudio
          assets={state.imageAssets}
          jobs={state.imageJobs}
          referenceImage={state.referenceImage}
          pendingRestore={pendingRestore || undefined}
          missingReferences={missingReferences}
        />
      </div>
    </StudioLayout>
  );
}
