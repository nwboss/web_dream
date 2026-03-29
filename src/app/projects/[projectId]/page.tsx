import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { GenerationPanel } from "@/components/generation-panel";
import { ProjectActions } from "@/components/project-actions";
import { ShotEditor } from "@/components/shot-editor";
import { StudioModuleNav } from "@/components/studio-module-nav";
import { getProject, getProjectStats } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    shot?: string;
    module?: string;
  }>;
};

type WorkspaceModule = "image" | "video" | "project";

function normalizeModule(value: string | undefined): WorkspaceModule {
  if (value === "video" || value === "project") {
    return value;
  }

  return "image";
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const session = await requireSession();
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const project = await getProject(session.email, projectId);

  if (!project) {
    notFound();
  }

  const selectedShotId = resolvedSearchParams.shot;
  const activeModule = normalizeModule(resolvedSearchParams.module);
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

      <section className="workspace-grid">
        <aside className="workspace-sidebar panel">
          <div className="workspace-block-head">
            <div>
              <h2>场次结构</h2>
              <p className="muted">
                {stats.sceneCount} 个场次 · {stats.shotCount} 个分镜 · {stats.readyCount} 个可生成
              </p>
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

        <section className="workspace-main workspace-main-stack">
          {selectedShot ? (
            <div className="panel workspace-module-shell">
              <div className="workspace-module-head">
                <div>
                  <span className="pill">三模块工作台</span>
                  <h2>{project.title}</h2>
                  <p className="muted">先在图片模块出图，再切到视频，最后在漫剧项目模块里组织成片。</p>
                </div>
                <div className="workspace-module-tabs">
                  <StudioModuleNav active="project" projectId={project.id} shotId={selectedShot.id} />
                </div>
              </div>

              {activeModule === "image" ? (
                <div className="workspace-empty">
                  <h2>图片生成已独立出去</h2>
                  <p className="muted">图片生成功能现在不依赖项目，已经移动到独立图片模块。你可以先在那里生成，再回来把结果纳入漫剧项目。</p>
                  <Link className="btn btn-primary" href={"/studio/images" as Route}>
                    去独立图片生成
                  </Link>
                </div>
              ) : null}

              {activeModule === "video" ? (
                <div className="workspace-empty">
                  <h2>视频生成已独立出去</h2>
                  <p className="muted">视频生成现在不依赖项目，已经移动到独立视频模块。你可以先在那里生成片段，再回来挂到当前分镜。</p>
                  <Link className="btn btn-primary" href={"/studio/videos" as Route}>
                    去独立视频生成
                  </Link>
                </div>
              ) : null}

              {activeModule === "project" ? (
                <div className="workspace-project-grid">
                  <ShotEditor projectId={project.id} shot={selectedShot} variant="project" />
                  <GenerationPanel
                    projectId={project.id}
                    shot={selectedShot}
                    showModeTabs={true}
                    title="项目驱动的漫剧生成"
                    description="这里是生产台。图片和视频结果会在这里统一挂到当前分镜，方便做版本管理和连续创作。"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="panel workspace-empty">
              <h2>先添加一个分镜</h2>
              <p className="muted">当前项目还没有可编辑的分镜。你可以先在左侧创建场次，再添加一个分镜进入编辑。</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
