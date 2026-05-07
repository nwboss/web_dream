import Link from "next/link";

const features = [
  {
    title: "AI 图片生成",
    description: "基于即梦引擎，快速生成高质量漫画风格图片"
  },
  {
    title: "AI 视频生成",
    description: "图片一键生成动态视频，打造完整漫剧内容"
  },
  {
    title: "项目管理",
    description: "统一管理创作项目，支持多版本素材对比"
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="shell hero">
        <div className="hero-card">
          <span className="eyebrow">AI 漫剧创作工作台</span>
          <h1>用 AI 创作漫剧内容</h1>
          <p>
            快速生成高质量图片和视频，打造完整的漫剧作品
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="/register">
              开始创作
            </Link>
            <Link className="btn btn-secondary" href="/login">
              登录
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="metrics">
            <div className="metric">
              <strong>AI 生成</strong>
              <span>即梦引擎驱动</span>
            </div>
            <div className="metric">
              <strong>图片 + 视频</strong>
              <span>一站式创作</span>
            </div>
            <div className="metric">
              <strong>云端管理</strong>
              <span>随时访问</span>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section" id="features">
        <div className="section-head">
          <div>
            <h2>核心功能</h2>
          </div>
        </div>

        <div className="grid-3">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell">
        <div className="cta-banner">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2>立即开始创作</h2>
            </div>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">
                注册账号
              </Link>
              <Link className="btn btn-secondary" href="/dashboard">
                查看控制台
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="shell footer">即梦漫剧工坊</footer>
    </main>
  );
}
