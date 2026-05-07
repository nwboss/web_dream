"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type AuthMode = "login" | "register" | "forgot-password";

type AuthFormProps = {
  mode: AuthMode;
};

type AppRedirect = "/" | "/dashboard" | "/studio/images" | "/projects" | "/login" | "/register" | "/forgot-password" | "/account";

const copy: Record<AuthMode, { title: string; subtitle: string; endpoint: string; button: string }> = {
  login: {
    title: "登录",
    subtitle: "继续你的创作",
    endpoint: "/api/auth/login",
    button: "登录"
  },
  register: {
    title: "注册",
    subtitle: "开始 AI 创作",
    endpoint: "/api/auth/register",
    button: "注册"
  },
  "forgot-password": {
    title: "找回密码",
    subtitle: "输入邮箱找回账户",
    endpoint: "/api/auth/forgot-password",
    button: "发送"
  }
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [isPending, startTransition] = useTransition();
  const content = copy[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    startTransition(async () => {
      setMessage("");
      setStatus("idle");

      const response = await fetch(content.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { ok: boolean; message?: string; redirectTo?: AppRedirect };

      if (!response.ok || !data.ok) {
        setStatus("error");
        setMessage(data.message || "操作未完成，请稍后再试。");
        return;
      }

      setStatus("success");
      setMessage(data.message || "操作成功。");

      if (data.redirectTo) {
        router.push(data.redirectTo as Route);
        router.refresh();
      }
    });
  }

  return (
    <div className="auth-card">
      <h1>{content.title}</h1>
      <p className="muted">{content.subtitle}</p>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <div className="field">
            <label htmlFor="name">昵称</label>
            <input id="name" name="name" placeholder="输入昵称" required />
          </div>
        )}

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input id="email" name="email" type="email" placeholder="name@example.com" required />
        </div>

        {mode !== "forgot-password" && (
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="至少 8 位"
              required
              minLength={8}
            />
          </div>
        )}

        {message && (
          <div className={`form-message ${status}`}>
            {message}
          </div>
        )}

        <div className="auth-actions">
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            {isPending ? "提交中..." : content.button}
          </button>
          {mode === "login" ? (
            <Link className="btn btn-secondary" href="/register">
              注册
            </Link>
          ) : mode === "register" ? (
            <Link className="btn btn-secondary" href="/login">
              登录
            </Link>
          ) : (
            <Link className="btn btn-secondary" href="/login">
              返回
            </Link>
          )}
        </div>
      </form>

      <div className="inline-actions" style={{ marginTop: 16 }}>
        {mode === "login" && (
          <Link className="nav-link" href="/forgot-password">
            忘记密码
          </Link>
        )}
        <Link className="nav-link" href="/">
          返回首页
        </Link>
      </div>
    </div>
  );
}
