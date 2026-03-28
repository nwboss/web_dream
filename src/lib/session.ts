import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE, parseSessionToken } from "@/lib/auth";

export async function requireSession() {
  const cookieStore = await cookies();
  const session = await parseSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  return session;
}
