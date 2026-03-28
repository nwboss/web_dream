import Link from "next/link";

const features = [
  {
    title: "脚本到分镜",
    description: "从故事梗概、角色设定到分镜描述，先打磨创作流程，再接入自动拆镜能力。"
  },
  {
    title: "图片与视频一体化",
    description: "同一个分镜下统一管理静态图、图生图结果、视频任务和主版本素材。"
  },
  {
    title: "To C 账户体系",
    description: "从 Sprint 1 开始纳入登录、个人项目、额度记录和后续商业化预留。"
  }
];

const templates = [
  {
    title: "都市逆袭短剧",
    tag: "高转化题材",
    description: "适合先验证角色立绘、封面冲突图和 5 秒视频片段的组合工作流。"
  },
  {
    title: "校园恋爱漫剧",
    tag: "新手友好",
    description: "适合测试统一画风、多角色场景和轻剧情分镜的批量生产。"
  },
  {
    title: "悬疑反转故事",
    tag: "视频感更强",
    description: "适合验证图生视频、首尾帧镜头和连续项目预览的价值。"
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="shell hero">
        <div className="hero-card">
          <span className="eyebrow">即梦 AI API + 图片视频漫剧工作台</span>
          <h1>把一句故事，推成一部能预览的 AI 漫剧。</h1>
          <p>
            这是一个面向个人创作者的创作工作台。你可以从脚本、角色和分镜出发，逐步生成图片、视频和版本素材，并在同一个项目里持续迭代。
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="/register">
              免费开始
            </Link>
            <Link className="btn btn-secondary" href="/login">
              登录继续创作
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="metrics">
            <div className="metric">
              <strong>10 分钟</strong>
              <span>新用户完成第一次项目创建和生图闭环</span>
            </div>
            <div className="metric">
              <strong>图片 + 视频</strong>
              <span>同一分镜下统一管理，多版本可切换</span>
            </div>
            <div className="metric">
              <strong>账户可追踪</strong>
              <span>登录、额度、项目归属从首期就纳入设计</span>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section" id="features">
        <div className="section-head">
          <div>
            <h2>当前已搭好的 Sprint 0 + Sprint 1 基础盘</h2>
            <p>先把 To C 的第一印象、认证入口和受保护工作区建立起来，后面 Sprint 2 再接项目与分镜，Sprint 3/4 接图片和视频。</p>
          </div>
        </div>

        <div className="grid-3">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <span className="pill">核心能力</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell section" id="templates">
        <div className="section-head">
          <div>
            <h2>模板体验区</h2>
            <p>首屏先用模板项目解释产品价值，让用户在真正生成前就理解创作路径，降低 To C 转化损耗。</p>
          </div>
        </div>

        <div className="grid-3">
          {templates.map((template) => (
            <article className="template-card" key={template.title}>
              <span className="pill">{template.tag}</span>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell">
        <div className="cta-banner">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2>现在进入账户体系和工作台骨架</h2>
              <p>这一步不是最终产品，而是后续接数据库、项目管理、额度扣减和即梦 Provider 的稳定落脚点。</p>
            </div>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">
                注册体验
              </Link>
              <Link className="btn btn-secondary" href="/dashboard">
                查看控制台
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="shell footer">即梦漫剧工坊 · Sprint 0 + Sprint 1 Skeleton</footer>
    </main>
  );
}
