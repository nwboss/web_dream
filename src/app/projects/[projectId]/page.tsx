import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerationPanel } from "@/components/generation-panel";
import { ProjectActions } from "@/components/project-actions";
import { ShotEditor } from "@/components/shot-editor";
import { getProject, getProjectStats } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    shot?: string;
  }>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const session = await requireSession();
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const project = await getProject(session.email, projectId);

  if (!project) {
    notFound();
  }

  const selectedShotId = resolvedSearchParams.shot;
  const firstScene = project.scenes[0];
  const selectedScene = project.scenes.find((scene) => scene.shots.some((shot) => shot.id === selectedShotId)) || firstScene;
  const selectedShot = selectedScene?.shots.find((shot) => shot.id === selectedShotId) || selectedScene?.shots[0] || null;
  const stats = getProjectStats(project);

  return (
    <main className="shell workspace-layout">
      <div className="workspace-topbar">
        <div>
          <span className="pill">Sprint 2 / 项目工作台</span>
          <h1 className="dashboard-title">{project.title}</h1>
          <p className="muted">{project.premise}</p>
        </div>

        <div className="inline-actions">
          <Link className="btn btn-secondary" href="/dashboard">
            返回项目列表
          </Link>
          <Link className="btn btn-ghost" href="/account">
            账户中心
          </Link>
        </div>
      </div>

      <section className="workspace-metrics">
        <article className="metric">
          <strong>{stats.sceneCount}</strong>
          <span>场次数</span>
        </article>
        <article className="metric">
          <strong>{stats.shotCount}</strong>
          <span>分镜总数</span>
        </article>
        <article className="metric">
          <strong>{stats.readyCount}</strong>
          <span>可进入生成阶段</span>
        </article>
      </section>

      <section className="workspace-grid">
        <aside className="workspace-sidebar panel">
          <div className="workspace-block-head">
            <div>
              <h2>场次结构</h2>
              <p className="muted">先把内容结构排清楚，再进入即梦生成。</p>
            </div>
            {selectedScene ? <ProjectActions projectId={project.id} sceneId={selectedScene.id} /> : null}
          </div>

          <div className="scene-stack">
            {project.scenes.map((scene) => (
              <section className="scene-card" key={scene.id}>
                <div className="scene-card-head">
                  <strong>{scene.title}</strong>
                  <span>{scene.shots.length} 个分镜</span>
                </div>

                <div className="shot-stack">
                  {scene.shots.length ? (
                    scene.shots.map((shot) => (
                      <Link
                        key={shot.id}
                        className={`shot-link ${selectedShot?.id === shot.id ? "is-active" : ""}`}
                        href={`/projects/${project.id}?shot=${shot.id}`}
                      >
                        <strong>{shot.title}</strong>
                        <span>{shot.status}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="shot-empty">这个场次还没有分镜，先添加一个镜头。</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className="workspace-main">
          {selectedShot ? (
            <ShotEditor projectId={project.id} shot={selectedShot} />
          ) : (
            <div className="panel workspace-empty">
              <h2>先添加一个分镜</h2>
              <p className="muted">当前项目还没有可编辑的分镜。你可以先在左侧创建场次，再添加一个分镜进入编辑。</p>
            </div>
          )}
        </section>

        <aside className="workspace-right panel">
          <div className="workspace-block-head">
            <div>
              <h2>生成结果区</h2>
              <p className="muted">最小 MVP 先用 mock 任务打通结果闭环，后续直接替换成即梦图片 / 视频生成。</p>
            </div>
          </div>

          {selectedShot ? <GenerationPanel projectId={project.id} shot={selectedShot} /> : null}
        </aside>
      </section>
    </main>
  );
}
