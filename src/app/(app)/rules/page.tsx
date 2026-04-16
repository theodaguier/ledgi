import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
import RulesPageClient from "./page-client";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Règles",
};

export default async function RulesPage() {
  const ctx = await getWorkspaceContext();

  const [rules, categories] = await Promise.all([
    prisma.categorizationRule.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { priority: "asc" },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      where: { OR: [{ workspaceId: ctx.workspaceId }, { isSystem: true }] },
      orderBy: { name: "asc" },
    }),
  ]);

  return <RulesPageClient rules={rules} categories={categories} />;
}
