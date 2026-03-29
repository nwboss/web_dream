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
    title: "欢迎回来",
    subtitle: "登录后继续你的漫剧项目、素材和生成任务。",
    endpoint: "/api/auth/login",
    button: "登录并进入工作台"
  },
  register: {
    title: "创建你的创作账户",
    subtitle: "注册后即可保存项目、管理额度，并开始第一部 AI 漫剧。",
    endpoint: "/api/auth/register",
    button: "注册并开始创作"
  },
  "forgot-password": {
    title: "找回登录方式",
    subtitle: "首期先提供邮箱回执占位流程，方便后续接入真实验证码或重置邮件。",
    endpoint: "/api/auth/forgot-password",
    button: "发送找回说明"
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
      <span className="pill">Sprint 1 / To C 登录体系</span>
      <h1>{content.title}</h1>
      <p className="muted">{content.subtitle}</p>

      <form onSubmit={handleSubmit}>
        {mode !== "forgot-password" ? (
          <div className="field">
            <label htmlFor="name">昵称</label>
            <input id="name" name="name" placeholder="输入你的创作者昵称" required={mode === "register"} />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input id="email" name="email" type="email" placeholder="name@example.com" required />
        </div>

        {mode !== "forgot-password" ? (
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="至少 8 位，后续会接入真实加密存储"
              required
              minLength={8}
            />
          </div>
        ) : null}

        <div className={`form-message ${status === "idle" ? "" : status}`}>
          {message || "当前为 Sprint 1 骨架版本，账户数据还未接入数据库持久化。"}
        </div>

        <div className="auth-actions">
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            {isPending ? "提交中..." : content.button}
          </button>
          {mode === "login" ? (
            <Link className="btn btn-secondary" href="/register">
              去注册
            </Link>
          ) : (
            <Link className="btn btn-secondary" href="/login">
              返回登录
            </Link>
          )}
        </div>
      </form>

      <div className="inline-actions" style={{ marginTop: 16 }}>
        <Link className="nav-link" href="/forgot-password">
          忘记密码
        </Link>
        <Link className="nav-link" href="/">
          返回首页
        </Link>
      </div>
    </div>
  );
}
