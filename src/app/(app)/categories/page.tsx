import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import CategoriesPageClient from "./page-client";

export default async function CategoriesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
    orderBy: [{ isIncome: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return <CategoriesPageClient categories={categories} />;
}
