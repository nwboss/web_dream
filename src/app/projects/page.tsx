import Link from "next/link";
import type { Route } from "next";

import { CreateProjectForm } from "@/components/create-project-form";
import { StudioLayout } from "@/components/studio-layout";
import { getProjectStats, listProjects } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await listProjects(session.email);

  return (
    <StudioLayout>
      <div className="studio-content">
        <div className="studio-header">
          <h1 className="studio-title">我的项目</h1>
          <p className="studio-subtitle">管理所有漫剧创作项目</p>
        </div>

        <div className="panel panel-padded">
          <section className="dashboard-sprint-grid dashboard-sprint-grid-compact">
            <div className="project-stack">
              <div className="workspace-block-head">
                <div>
                  <h2>项目列表</h2>
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
                        打开
                      </Link>
                    </div>
                    <p>{project.premise}</p>
                    <div className="project-card-meta">
                      <span>{stats.sceneCount} 场次</span>
                      <span>{stats.shotCount} 分镜</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <CreateProjectForm />
          </section>
        </div>
      </div>
    </StudioLayout>
  );
}
