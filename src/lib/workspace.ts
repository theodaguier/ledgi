import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import type { Workspace, WorkspaceMember, WorkspaceRole, User } from "@prisma/client";

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  workspace: Workspace;
  membership: WorkspaceMember & { user: User };
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const userId = session.user.id;

  const activeWorkspaceId = await getActiveWorkspaceId(userId);

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: activeWorkspaceId, userId } },
    include: { workspace: true, user: true },
  });

  if (!membership) {
    throw new Error("Not a member of this workspace");
  }

  return {
    workspaceId: membership.workspaceId,
    userId,
    role: membership.role,
    workspace: membership.workspace,
    membership,
  };
}

export async function getActiveWorkspaceId(userId: string): Promise<string> {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (userSettings?.activeWorkspaceId) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: userSettings.activeWorkspaceId,
          userId,
        },
      },
    });
    if (member) return userSettings.activeWorkspaceId;
  }

  const firstMembership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: { workspace: true },
  });

  if (!firstMembership) {
    throw new Error("No workspace found");
  }

  return firstMembership.workspaceId;
}

export async function setActiveWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    throw new Error("Not a member of this workspace");
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { activeWorkspaceId: workspaceId },
    create: { userId, activeWorkspaceId: workspaceId },
  });
}

export async function listUserWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
}

export async function listWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
}
