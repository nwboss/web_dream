import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getStudioState } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requireSession();
  const state = await getStudioState(session.email);

  // 合并所有任务并按时间排序
  const allJobs = [
    ...state.imageJobs.map((job) => ({ ...job, type: "image" as const })),
    ...state.videoJobs.map((job) => ({ ...job, type: "video" as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 合并所有资源并按时间排序
  const allAssets = [
    ...state.imageAssets,
    ...state.videoAssets
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const processingJobs = allJobs.filter((job) => job.status === "processing");
  const completedJobs = allJobs.filter((job) => job.status === "succeeded");
  const failedJobs = allJobs.filter((job) => job.status === "failed");

  return (
    <main className="shell workspace-layout">
      <div className="workspace-topbar">
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>生成历史</h1>
          <p className="muted" style={{ marginTop: "8px" }}>
            查看所有图片和视频的生成记录
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link className="btn btn-ghost" href="/studio/images">
            图片工坊
          </Link>
          <Link className="btn btn-ghost" href="/studio/videos">
            视频工坊
          </Link>
          <Link className="btn btn-ghost" href="/account">
            账户
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        {/* 进行中的任务 */}
        {processingJobs.length > 0 && (
          <section className="panel">
            <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 600 }}>
              生成中 ({processingJobs.length})
            </h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {processingJobs.map((job) => (
                <div
                  key={job.id}
                  className="history-job-card"
                  style={{
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(255, 209, 102, 0.08)",
                    border: "1px solid rgba(255, 209, 102, 0.2)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "24px" }}>
                      {job.type === "image" ? "🎨" : "🎬"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <strong>{job.name || (job.type === "image" ? "图片生成" : "视频生成")}</strong>
                        <span className="pill" style={{ background: "rgba(255, 209, 102, 0.2)", height: "24px", padding: "0 10px", fontSize: "12px" }}>
                          生成中
                        </span>
                      </div>
                      <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
                        {job.message}
                      </p>
                    </div>
                    <span className="muted" style={{ fontSize: "13px" }}>
                      {new Date(job.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 生成的资源 */}
        <section className="panel">
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 600 }}>
            生成结果 ({allAssets.length})
          </h2>
          {allAssets.length > 0 ? (
            <div className="studio-result-grid">
              {allAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="result-card"
                  style={{
                    padding: "10px",
                    borderRadius: "16px",
                    border: "1px solid var(--line)",
                    background: "rgba(255, 255, 255, 0.03)"
                  }}
                >
                  {asset.kind === "video" ? (
                    <video
                      className="result-preview"
                      src={asset.previewUrl}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "12px"
                      }}
                    />
                  ) : (
                    <img
                      className="result-preview"
                      src={asset.previewUrl}
                      alt={asset.title}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "12px"
                      }}
                    />
                  )}
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "16px" }}>
                        {asset.kind === "video" ? "🎬" : "🎨"}
                      </span>
                      <strong style={{ fontSize: "14px" }}>{asset.title}</strong>
                    </div>
                    <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
                      {new Date(asset.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                borderRadius: "16px",
                border: "1px dashed rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.02)"
              }}
            >
              <p className="muted">暂无生成结果</p>
            </div>
          )}
        </section>

        {/* 失败的任务 */}
        {failedJobs.length > 0 && (
          <section className="panel">
            <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 600 }}>
              生成失败 ({failedJobs.length})
            </h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {failedJobs.map((job) => (
                <div
                  key={job.id}
                  className="history-job-card"
                  style={{
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(255, 154, 169, 0.06)",
                    border: "1px solid rgba(255, 154, 169, 0.15)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "24px" }}>
                      {job.type === "image" ? "🎨" : "🎬"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <strong>{job.name || (job.type === "image" ? "图片生成" : "视频生成")}</strong>
                        <span className="pill" style={{ background: "rgba(255, 154, 169, 0.2)", height: "24px", padding: "0 10px", fontSize: "12px" }}>
                          失败
                        </span>
                      </div>
                      <p className="muted" style={{ margin: 0, fontSize: "14px", color: "#ff9aa9" }}>
                        {job.message}
                      </p>
                    </div>
                    <span className="muted" style={{ fontSize: "13px" }}>
                      {new Date(job.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 已完成的任务（只显示job记录，不显示资源） */}
        {completedJobs.length > 0 && (
          <details className="panel" style={{ cursor: "pointer" }}>
            <summary style={{ fontWeight: 600, fontSize: "20px", marginBottom: "20px" }}>
              已完成任务 ({completedJobs.length})
            </summary>
            <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
              {completedJobs.map((job) => (
                <div
                  key={job.id}
                  className="history-job-card"
                  style={{
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(163, 230, 53, 0.06)",
                    border: "1px solid rgba(163, 230, 53, 0.15)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "24px" }}>
                      {job.type === "image" ? "🎨" : "🎬"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <strong>{job.name || (job.type === "image" ? "图片生成" : "视频生成")}</strong>
                        <span className="pill" style={{ background: "rgba(163, 230, 53, 0.2)", height: "24px", padding: "0 10px", fontSize: "12px" }}>
                          已完成
                        </span>
                      </div>
                      <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
                        {job.message}
                      </p>
                    </div>
                    <span className="muted" style={{ fontSize: "13px" }}>
                      {new Date(job.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
