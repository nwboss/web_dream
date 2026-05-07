import Link from "next/link";
import { cookies } from "next/headers";
import type { Route } from "next";

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
          {session ? (
            <>
              <Link className="nav-link" href={"/studio/images" as Route}>
                工作台
              </Link>
              <Link className="nav-link" href={"/projects" as Route}>
                项目
              </Link>
              <Link className="nav-link" href="/account">
                账户
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="nav-link" href="/#features">
                功能
              </Link>
              <Link className="btn btn-secondary" href="/login">
                登录
              </Link>
              <Link className="btn btn-primary" href="/register">
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
