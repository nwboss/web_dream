import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  await requireSession();
  redirect("/studio/images" as Route);
}
