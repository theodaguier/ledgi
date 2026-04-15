import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import RulesPageClient from "./page-client";

export default async function RulesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const [rules, categories] = await Promise.all([
    prisma.categorizationRule.findMany({
      where: { userId: session.user.id },
      orderBy: { priority: "asc" },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId: session.user.id }, { isSystem: true }] },
      orderBy: { name: "asc" },
    }),
  ]);

  return <RulesPageClient rules={rules} categories={categories} />;
}
