"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";
import { randomBytes } from "crypto";
import slugify from "slugify";
import { sendInvitationEmail } from "@/lib/email";
import { inviteFormSchema } from "@/lib/validation/schemas";

export async function createWorkspace(data: {
  name: string;
  type: "PERSONAL" | "COUPLE" | "FAMILY";
  defaultCurrency?: string;
}) {
  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Only owners and admins can create workspaces");
  }

  const slug = slugify(`${data.name}-${Date.now()}`, { lower: true, locale: "fr" });

  const workspace = await prisma.workspace.create({
    data: {
      name: data.name,
      slug,
      type: data.type,
      defaultCurrency: data.defaultCurrency ?? "EUR",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: ctx.userId,
      role: "OWNER",
    },
  });

  revalidatePath("/settings");
  return workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; defaultCurrency?: string }
) {
  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Only owners and admins can update workspace");
  }

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.defaultCurrency ? { defaultCurrency: data.defaultCurrency } : {}),
    },
  });

  revalidatePath("/settings");
  return workspace;
}

export async function inviteMember(
  email: string,
  role: "ADMIN" | "MEMBER" = "MEMBER"
) {
  const parsed = inviteFormSchema.safeParse({ email, role });
  if (!parsed.success) {
    const error = parsed.error.issues[0];
    throw new Error(error?.message ?? "Validation failed");
  }

  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Only owners and admins can invite members");
  }

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspaceId, user: { email } },
  });

  if (existingMember) {
    throw new Error("Cet utilisateur est déjà membre de cet espace");
  }

  const existingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      email,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    throw new Error("Une invitation est déjà en attente pour cet email");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: ctx.workspaceId,
      email,
      role,
      status: "PENDING",
      token,
      expiresAt,
      inviterId: ctx.userId,
    },
  });

  await sendInvitationEmail({
    to: email,
    inviterName: ctx.membership.user.name ?? "Quelqu'un",
    workspaceName: ctx.workspace.name,
    token,
  }).catch((err) => {
    console.error("Failed to send invitation email:", err);
  });

  revalidatePath("/settings");
  return invitation;
}

export async function cancelInvitation(invitationId: string) {
  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Only owners and admins can cancel invitations");
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELED" },
  });

  revalidatePath("/settings");
}

export async function getInvitationPreview(token: string): Promise<
  | { valid: true; error: null; email: string; workspaceName: string; inviterName: string | null }
  | { valid: false; error: string; email: string | null; workspaceName: string | null; inviterName: string | null }
> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
      inviter: { select: { name: true } },
    },
  });

  if (!invitation) {
    return { valid: false as const, error: "Invitation introuvable", email: null, workspaceName: null, inviterName: null };
  }

  if (invitation.status === "ACCEPTED") {
    return { valid: false as const, error: "Cette invitation a déjà été acceptée", email: invitation.email, workspaceName: invitation.workspace.name, inviterName: invitation.inviter.name };
  }

  if (invitation.status === "CANCELED") {
    return { valid: false as const, error: "Cette invitation a été annulée", email: invitation.email, workspaceName: invitation.workspace.name, inviterName: invitation.inviter.name };
  }

  if (invitation.expiresAt < new Date()) {
    return { valid: false as const, error: "Cette invitation a expiré", email: invitation.email, workspaceName: invitation.workspace.name, inviterName: invitation.inviter.name };
  }

  return {
    valid: true,
    error: null,
    email: invitation.email,
    workspaceName: invitation.workspace.name,
    inviterName: invitation.inviter.name,
  };
}

export async function acceptInvitation(token: string) {
  const authActions = await import("@/lib/auth");
  const headers = (await import("next/headers")).headers;
  let session = null;
  try {
    session = await authActions.auth.api.getSession({ headers: await headers() });
  } catch {
    throw new Error("Vous devez être connecté pour accepter cette invitation");
  }

  if (!session?.user) {
    throw new Error("Vous devez être connecté pour accepter cette invitation");
  }

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invitation) {
    throw new Error("Invitation introuvable");
  }

  if (invitation.status !== "PENDING" && invitation.status !== "ACCEPTED") {
    throw new Error("Cette invitation n'est plus active");
  }

  if (invitation.status === "ACCEPTED") {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
        },
      },
    });
    if (existingMember) {
      return invitation.workspace;
    }
    throw new Error("Cette invitation a déjà été acceptée par un autre compte");
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("Cette invitation a expiré");
  }

  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error(`Cette invitation est destinée à ${invitation.email}. Connectez-vous avec le bon compte.`);
  }

  await prisma.$transaction(async (p) => {
    await p.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: session!.user.id,
        role: invitation.role,
      },
    });

    await p.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    await p.userSettings.upsert({
      where: { userId: session!.user.id },
      update: { activeWorkspaceId: invitation.workspaceId },
      create: { userId: session!.user.id, activeWorkspaceId: invitation.workspaceId },
    });
  });

  revalidatePath("/settings");
  return invitation.workspace;
}

export async function removeMember(memberId: string) {
  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("Only owners and admins can remove members");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });

  if (!member) throw new Error("Membre introuvable");

  if (member.role === "OWNER") {
    throw new Error("Impossible de supprimer le propriétaire de l'espace");
  }

  await prisma.workspaceMember.delete({
    where: { id: memberId },
  });

  revalidatePath("/settings");
}

export async function leaveWorkspace(workspaceId: string) {
  const ctx = await getWorkspaceContext();

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ctx.userId } },
  });

  if (!member) throw new Error("Vous n'êtes pas membre de cet espace");

  if (member.role === "OWNER") {
    throw new Error("Le propriétaire ne peut pas quitter l'espace. Transférez d'abord la propriété ou supprimez l'espace.");
  }

  await prisma.workspaceMember.delete({
    where: { id: member.id },
  });

  revalidatePath("/settings");
}

export async function updateMemberRole(memberId: string, role: "ADMIN" | "MEMBER") {
  const ctx = await getWorkspaceContext();

  if (ctx.role !== "OWNER") {
    throw new Error("Only the owner can change member roles");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });

  if (!member) throw new Error("Membre introuvable");
  if (member.role === "OWNER") throw new Error("Impossible de modifier le rôle du propriétaire");

  await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
  });

  revalidatePath("/settings");
}
