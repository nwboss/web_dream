import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE, parseSessionToken } from "@/lib/auth";

const mockQuota = [
  { label: "图片额度", value: "20 / 月" },
  { label: "视频额度", value: "5 / 月" },
  { label: "当前计划", value: "免费版" }
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
          <h1 className="account-title">账户中心</h1>
        </div>
      </div>

      <section className="account-grid">
        <article className="account-card">
          <h3>账户信息</h3>
          <p>昵称：{session.name}</p>
          <p>邮箱：{session.email}</p>
        </article>

        <article className="account-card">
          <h3>使用额度</h3>
          <ul className="list">
            {mockQuota.map((item) => (
              <li key={item.label}>
                {item.label}：{item.value}
              </li>
            ))}
          </ul>
        </article>

        <article className="account-card">
          <h3>更多功能</h3>
          <ul className="list">
            <li>我的项目</li>
            <li>使用记录</li>
            <li>订阅管理</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
