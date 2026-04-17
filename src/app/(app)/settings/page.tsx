import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import { getAppMessages } from "@/lib/app-messages";
import { normalizeAppLocale } from "@/lib/locale";
import {
  SettingsContent,
  type TabValue,
} from "./page-client";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { getWorkspaceContext, listWorkspaceMembers } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Paramètres",
};

function SettingsLoading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppPageShell className="max-w-2xl">
      <AppPageHeader
        title={title}
        description={description}
      />
    </AppPageShell>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const rawTab = params?.tab;
  const VALID_TABS = ["profil", "interface", "securite", "cles-api", "partage"] as const;
  const initialTab = VALID_TABS.includes(rawTab as (typeof VALID_TABS)[number])
    ? (rawTab as (typeof VALID_TABS)[number])
    : "profil";

  const apiKeys = await prisma.apiKey.findMany({
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

  const user = {
    id: ctx.userId,
    email: ctx.membership.user.email,
    name: ctx.membership.user.name,
    image: ctx.membership.user.image,
  };

  const userSettings = (async () => {
    try {
      return await prisma.userSettings.findUnique({
        where: { userId: ctx.userId },
      });
    } catch {
      return null;
    }
  })();

  const members = (async () => {
    try {
      return await listWorkspaceMembers(ctx.workspaceId);
    } catch {
      return [];
    }
  })();

  const invitations = (async () => {
    try {
      return await prisma.workspaceInvitation.findMany({
        where: { workspaceId: ctx.workspaceId, status: "PENDING" },
        include: { inviter: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  })();

  const [settingsResult, membersResult, invitationsResult] =
    await Promise.all([userSettings, members, invitations]);
  const settingsMessages = getAppMessages(
    normalizeAppLocale(settingsResult?.locale)
  ).settings;

  return (
    <Suspense
      fallback={
        <SettingsLoading
          title={settingsMessages.title}
          description={settingsMessages.description}
        />
      }
    >
      <SettingsContent
        user={user}
        userSettings={settingsResult}
        apiKeys={apiKeys.map((k: typeof apiKeys[number]) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
        initialTab={initialTab as TabValue}
        workspace={{
          id: ctx.workspaceId,
          name: ctx.workspace.name,
          type: ctx.workspace.type,
          role: ctx.role,
        }}
        members={membersResult.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
          },
        }))}
        invitations={invitationsResult.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
          inviter: {
            name: i.inviter.name,
            email: i.inviter.email,
          },
        }))}
      />
    </Suspense>
  );
}
