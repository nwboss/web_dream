import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { StudioLayout } from "@/components/studio-layout";
import { LogoutButton } from "@/components/logout-button";
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
    <StudioLayout>
      <div className="studio-content">
        <div className="studio-header">
          <h1 className="studio-title">账户设置</h1>
          <p className="studio-subtitle">管理你的个人信息和偏好设置</p>
        </div>

        <div className="account-grid">
          <article className="account-card panel">
            <h3>账户信息</h3>
            <div>
              <p><strong>昵称：</strong>{session.name}</p>
              <p><strong>邮箱：</strong>{session.email}</p>
            </div>
            <div style={{ marginTop: '24px' }}>
              <LogoutButton />
            </div>
          </article>

          <article className="account-card panel">
            <h3>使用额度</h3>
            <ul className="list">
              {mockQuota.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}：</strong>{item.value}
                </li>
              ))}
            </ul>
          </article>

          <article className="account-card panel">
            <h3>快速导航</h3>
            <ul className="list">
              <li>
                <Link href="/projects" className="text-accent">我的项目</Link>
              </li>
              <li>
                <Link href="/assets" className="text-accent">素材库</Link>
              </li>
              <li>
                <Link href="/studio/images" className="text-accent">图片生成</Link>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </StudioLayout>
  );
}
