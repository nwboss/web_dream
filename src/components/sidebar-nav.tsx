"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

export function SidebarNav() {
  const pathname = usePathname();

  const navItems = [
    {
      section: "生成",
      items: [
        { label: "图片生成", href: "/studio/images", icon: "●" },
        { label: "视频生成", href: "/studio/videos", icon: "▸" }
      ]
    },
    {
      section: "资产",
      items: [
        { label: "我的项目", href: "/projects", icon: "◆" },
        { label: "素材库", href: "/assets", icon: "■" }
      ]
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand">
          <div className="sidebar-brand-mark" />
          <span className="sidebar-brand-text">即梦工坊</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((group) => (
          <div key={group.section} className="sidebar-section">
            <h3 className="sidebar-section-title">{group.section}</h3>
            <ul className="sidebar-list">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href as Route}
                      className={`sidebar-item ${isActive ? "is-active" : ""}`}
                    >
                      <span className="sidebar-item-icon">{item.icon}</span>
                      <span className="sidebar-item-label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link href="/account" className="sidebar-item">
          <span className="sidebar-item-icon">⚙</span>
          <span className="sidebar-item-label">账户设置</span>
        </Link>
      </div>
    </aside>
  );
}
