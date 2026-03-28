import Link from "next/link";
import { cookies } from "next/headers";

import { AUTH_COOKIE, parseSessionToken } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const cookieStore = await cookies();
  const session = await parseSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" />
          <span>即梦漫剧工坊</span>
        </Link>

        <nav className="nav">
          <Link className="nav-link" href="/#features">
            产品能力
          </Link>
          <Link className="nav-link" href="/#templates">
            模板体验
          </Link>
          {session ? (
            <>
              <Link className="nav-link" href="/dashboard">
                控制台
              </Link>
              <Link className="nav-link" href="/account">
                账户中心
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="btn btn-secondary" href="/login">
                登录
              </Link>
              <Link className="btn btn-primary" href="/register">
                免费开始
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
