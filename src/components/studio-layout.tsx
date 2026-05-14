import type { ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";

type StudioLayoutProps = {
  children: ReactNode;
};

export function StudioLayout({ children }: StudioLayoutProps) {
  return (
    <div className="studio-layout">
      <SidebarNav />
      <main className="studio-main">
        {children}
      </main>
    </div>
  );
}
