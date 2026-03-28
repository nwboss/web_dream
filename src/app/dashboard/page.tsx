import Link from "next/link";
import { CreateProjectForm } from "@/components/create-project-form";
import { getProjectStats, listProjects } from "@/lib/project-store";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const projects = await listProjects(session.email);

  return (
    <main className="shell dashboard-layout">
      <div className="dashboard-hero">
        <div>
          <span className="pill">Sprint 2 / 项目列表</span>
          <h1 className="dashboard-title">{session.name}，你的漫剧项目工作台已经可以开始用了。</h1>
          <p className="muted">这一版已经把项目列表、新建项目和进入分镜工作台的主链路接起来了。下一步就是在这个基础上接图片和视频生成。</p>
        </div>

        <div className="inline-actions">
          <Link className="btn btn-primary" href="/account">
            查看账户
          </Link>
          <Link className="btn btn-secondary" href="/">
            返回首页
          </Link>
        </div>
      </div>

      <section className="dashboard-sprint-grid">
        <div className="project-stack">
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
                    进入工作台
                  </Link>
                </div>
                <p>{project.premise}</p>
                <div className="project-card-meta">
                  <span>{stats.sceneCount} 个场次</span>
                  <span>{stats.shotCount} 个分镜</span>
                  <span>{stats.readyCount} 个待生成镜头</span>
                </div>
              </article>
            );
          })}
        </div>

        <CreateProjectForm />
      </section>
    </main>
  );
}
