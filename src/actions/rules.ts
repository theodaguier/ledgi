"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MatchType } from "@prisma/client";

export async function createRule(data: {
  name: string;
  matchType: string;
  pattern: string;
  categoryId: string;
  description: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const existing = await prisma.categorizationRule.count({
    where: { userId: session.user.id },
  });

  await prisma.categorizationRule.create({
    data: {
      userId: session.user.id,
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const rule = await prisma.categorizationRule.findFirst({
    where: { id: ruleId, userId: session.user.id },
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await prisma.categorizationRule.deleteMany({
    where: { id: ruleId, userId: session.user.id },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function toggleRule(ruleId: string, isActive: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await prisma.categorizationRule.updateMany({
    where: { id: ruleId, userId: session.user.id },
    data: { isActive },
  });

  revalidatePath("/rules");
  revalidatePath("/transactions");
}

export async function reorderRules(ruleIds: string[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await Promise.all(
    ruleIds.map((id, index) =>
      prisma.categorizationRule.updateMany({
        where: { id, userId: session.user.id },
        data: { priority: index },
      })
    )
  );

  revalidatePath("/rules");
}
