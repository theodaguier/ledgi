"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Scope } from "@/lib/api-auth";
import { normalizeAppLocale } from "@/lib/locale";
import { getWorkspaceContext } from "@/lib/workspace";
import { apiKeyFormSchema } from "@/lib/validation/schemas";

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const res = await fetch(`${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: session.session.token ? `better-auth.session_token=${session.session.token}` : "",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Password change failed");
  }

  return res.json();
}

export async function updateProfile(data: { name?: string; image?: string | null }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const res = await fetch(`${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/update-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: session.session.token ? `better-auth.session_token=${session.session.token}` : "",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "Profile update failed");
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateUserImage(imageUrl: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const res = await fetch(`${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/update-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: session.session.token ? `better-auth.session_token=${session.session.token}` : "",
    },
    body: JSON.stringify({ image: imageUrl }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "Image update failed");
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function getUserSettings() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings) {
    return prisma.userSettings.create({
      data: { userId: session.user.id },
    });
  }

  return settings;
}

export async function updateUserSettings(data: {
  locale?: string;
  timezone?: string;
  defaultCurrency?: string;
  weekStartsOn?: number;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const nextData = {
    ...data,
    ...(data.locale !== undefined ? { locale: normalizeAppLocale(data.locale) } : {}),
  };

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: nextData,
    create: { userId: session.user.id, ...nextData },
  });

  revalidatePath("/settings");
  return settings;
}

export async function listApiKeys() {
  const ctx = await getWorkspaceContext();

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return keys.map((k: typeof keys[number]) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
}

export async function createNewApiKey(
  name: string,
  scopes: Scope[],
  expiresAtDays: number | null
) {
  const parsed = apiKeyFormSchema.safeParse({ name });
  if (!parsed.success) {
    const error = parsed.error.issues[0];
    throw new Error(error?.message ?? "Validation failed");
  }

  const ctx = await getWorkspaceContext();

  const expiresAt = expiresAtDays
    ? new Date(Date.now() + expiresAtDays * 24 * 60 * 60 * 1000)
    : undefined;

  const { raw, key } = await createApiKey(
    ctx.userId,
    ctx.workspaceId,
    name,
    scopes,
    { expiresAt }
  );

  revalidatePath("/settings");

  return { raw, key };
}

export async function revokeApiKey(keyId: string) {
  const ctx = await getWorkspaceContext();

  await prisma.apiKey.updateMany({
    where: { id: keyId, workspaceId: ctx.workspaceId },
    data: { isActive: false },
  });

  revalidatePath("/settings");
}
