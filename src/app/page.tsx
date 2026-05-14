import Link from "next/link";

const features = [
  {
    title: "AI 图片生成",
    description: "基于即梦引擎，快速生成高质量漫画风格图片",
    icon: "🎨"
  },
  {
    title: "AI 视频生成",
    description: "图片一键生成动态视频，打造完整漫剧内容",
    icon: "🎬"
  },
  {
    title: "项目管理",
    description: "统一管理创作项目，多版本素材对比",
    icon: "📋"
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="shell hero">
        <div className="hero-card hero-main">
          <span className="eyebrow">AI 漫剧创作平台</span>
          <h1>AI 驱动的漫剧创作</h1>
          <p className="hero-description">
            基于即梦引擎，轻松生成高质量图片和视频<br/>
            让创意快速变为现实
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="/register">
              立即开始
            </Link>
            <Link className="btn btn-secondary" href="/login">
              登录账户
            </Link>
          </div>
        </div>

        <div className="hero-card hero-stats">
          <div className="metrics">
            <div className="metric">
              <div className="metric-icon">⚡</div>
              <strong>快速生成</strong>
              <span>秒级响应</span>
            </div>
            <div className="metric">
              <div className="metric-icon">🎯</div>
              <strong>精准控制</strong>
              <span>首尾帧支持</span>
            </div>
            <div className="metric">
              <div className="metric-icon">☁️</div>
              <strong>云端存储</strong>
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
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="shell footer">
        <p>即梦工坊 - AI 驱动的漫剧创作平台</p>
      </footer>
    </main>
  );
}
