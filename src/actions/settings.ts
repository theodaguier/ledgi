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

type ActionResult = { ok: true } | { ok: false; error: string };

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Password change failed";
    return { ok: false, error: message };
  }
}

export async function updateProfile(data: {
  name?: string;
  image?: string | null;
}): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  try {
    await auth.api.updateUser({
      body: data,
      headers: await headers(),
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Profile update failed";
    return { ok: false, error: message };
  }
}

export async function updateUserImage(imageUrl: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  try {
    await auth.api.updateUser({
      body: { image: imageUrl },
      headers: await headers(),
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image update failed";
    return { ok: false, error: message };
  }
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
