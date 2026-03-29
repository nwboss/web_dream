import Link from "next/link";
import type { Route } from "next";

import { CreateProjectForm } from "@/components/create-project-form";
import { StudioModuleNav } from "@/components/studio-module-nav";
import { getProjectStats, listProjects } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await listProjects(session.email);

  return (
    <main className="shell dashboard-layout">
      <div className="workspace-topbar">
        <div>
          <span className="pill">模块三</span>
          <h1 className="dashboard-title">漫剧项目</h1>
          <p className="muted">这里专门负责项目、场次、分镜和素材管理。图片与视频生成已经独立出去。</p>
        </div>

        <div className="inline-actions">
          <Link className="btn btn-secondary" href={"/studio/images" as Route}>
            去图片生成
          </Link>
          <Link className="btn btn-ghost" href="/account">
            账户中心
          </Link>
        </div>
      </div>

      <div className="panel workspace-module-shell">
        <div className="workspace-module-head">
          <div>
            <span className="pill">三模块工作台</span>
            <h2>项目驱动的漫剧生成</h2>
          </div>
          <StudioModuleNav active="project" />
        </div>

        <section className="dashboard-sprint-grid dashboard-sprint-grid-compact">
          <div className="project-stack">
            <div className="workspace-block-head">
              <div>
                <h2>我的项目</h2>
                <p className="muted">{projects.length} 个项目</p>
              </div>
            </div>

            {projects.map((project) => {
              const stats = getProjectStats(project);
              return (
                <article className="dashboard-card" key={project.id}>
                  <div className="workspace-block-head">
                    <div>
                      <span className="pill">{project.genre}</span>
                      <h3>{project.title}</h3>
                    </div>
                    <Link className="btn btn-primary" href={`/projects/${project.id}`}>
                      进入项目
                    </Link>
                  </div>
                  <p>{project.premise}</p>
                  <div className="project-card-meta">
                    <span>{stats.sceneCount} 个场次</span>
                    <span>{stats.shotCount} 个分镜</span>
                    <span>{stats.readyCount} 个可生成</span>
                  </div>
                </article>
              );
            })}
          </div>

          <CreateProjectForm />
        </section>
      </div>
    </main>
  );
}
