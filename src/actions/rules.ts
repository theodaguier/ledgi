"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MatchType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/workspace";

export async function createRule(data: {
  name: string;
  matchType: string;
  pattern: string;
  categoryId: string;
  description: string;
}) {
  const ctx = await getWorkspaceContext();

  const existing = await prisma.categorizationRule.count({
    where: { workspaceId: ctx.workspaceId },
  });

  await prisma.categorizationRule.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      matchType: data.matchType as MatchType,
      pattern: data.pattern,
      categoryId: data.categoryId,
      description: data.description || null,
      priority: existing,
      isActive: true,
    },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function updateRule(
  ruleId: string,
  data: {
    name: string;
    matchType: string;
    pattern: string;
    categoryId: string;
    description: string;
  }
) {
  const ctx = await getWorkspaceContext();

  const rule = await prisma.categorizationRule.findFirst({
    where: { id: ruleId, workspaceId: ctx.workspaceId },
  });

  if (!rule) throw new Error("Règle non trouvée");

  await prisma.categorizationRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      matchType: data.matchType as MatchType,
      pattern: data.pattern,
      categoryId: data.categoryId,
      description: data.description || null,
    },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function deleteRule(ruleId: string) {
  const ctx = await getWorkspaceContext();

  await prisma.categorizationRule.deleteMany({
    where: { id: ruleId, workspaceId: ctx.workspaceId },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function toggleRule(ruleId: string, isActive: boolean) {
  const ctx = await getWorkspaceContext();

  await prisma.categorizationRule.updateMany({
    where: { id: ruleId, workspaceId: ctx.workspaceId },
    data: { isActive },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function reorderRules(ruleIds: string[]) {
  const ctx = await getWorkspaceContext();

  await Promise.all(
    ruleIds.map((id, index) =>
      prisma.categorizationRule.updateMany({
        where: { id, workspaceId: ctx.workspaceId },
        data: { priority: index },
      })
    )
  );

  revalidatePath("/rules");
}
