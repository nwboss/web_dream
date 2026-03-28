import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE, parseSessionToken } from "@/lib/auth";

const mockQuota = [
  { label: "免费图片次数", value: "20 / 月" },
  { label: "免费视频次数", value: "5 / 月" },
  { label: "当前计划", value: "Free Starter" }
];

export default async function AccountPage() {
  const cookieStore = await cookies();
  const session = await parseSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="shell account-layout">
      <div className="account-hero">
        <div>
          <span className="pill">账户中心</span>
          <h1 className="account-title">你的创作资产入口已经就位</h1>
          <p className="muted">这版先把 To C 项目最重要的账户骨架搭起来，后面会继续接真实用户信息、额度消耗、订单和订阅。</p>
        </div>
      </div>

      <section className="account-grid">
        <article className="account-card">
          <h3>账户信息</h3>
          <p>昵称：{session.name}</p>
          <p>邮箱：{session.email}</p>
        </article>

        <article className="account-card">
          <h3>配额占位</h3>
          <ul className="list">
            {mockQuota.map((item) => (
              <li key={item.label}>
                {item.label}：{item.value}
              </li>
            ))}
          </ul>
        </article>

        <article className="account-card">
          <h3>后续迭代入口</h3>
          <ul className="list">
            <li>我的项目</li>
            <li>使用记录</li>
            <li>订阅与订单</li>
            <li>通知和风控记录</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
