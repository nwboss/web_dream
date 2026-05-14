import { StudioLayout } from "@/components/studio-layout";
import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

  const allAssets = [...state.imageAssets, ...state.videoAssets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <StudioLayout>
      <div className="studio-content">
        <div className="studio-header">
          <h1 className="studio-title">素材库</h1>
          <p className="studio-subtitle">管理所有生成的图片和视频素材</p>
        </div>

        <div className="panel panel-padded">
          {allAssets.length > 0 ? (
            <div className="assets-grid">
              {allAssets.map((asset) => (
                <article key={asset.id} className="asset-item">
                  <div className="asset-preview-box">
                    {asset.kind === "image" ? (
                      <img src={asset.previewUrl} alt={asset.title} className="asset-preview" />
                    ) : (
                      <video src={asset.previewUrl} className="asset-preview" controls />
                    )}
                  </div>
                  <div className="asset-info">
                    <span className="asset-type-badge">
                      {asset.kind === "image" ? "图片" : "视频"}
                    </span>
                    <span className="asset-date muted">
                      {new Date(asset.createdAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  {asset.originalUrl && (
                    <a
                      href={asset.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="asset-download-link"
                    >
                      查看原文件
                    </a>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="muted">
                暂无素材，开始生成你的第一个作品吧
              </p>
            </div>
          )}
        </div>
      </div>
    </StudioLayout>
  );
}
