"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  throw new Error("Password change not yet implemented - use Better Auth API");
}
