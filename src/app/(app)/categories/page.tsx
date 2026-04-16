import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
import CategoriesPageClient from "./page-client";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Catégories",
};

export default async function CategoriesPage() {
  const ctx = await getWorkspaceContext();

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ workspaceId: ctx.workspaceId }, { isSystem: true }],
    },
    orderBy: [{ isIncome: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return <CategoriesPageClient categories={categories} />;
}
