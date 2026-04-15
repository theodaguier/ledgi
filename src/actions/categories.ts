"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import slugify from "slugify";

function generateSlug(name: string): string {
  return slugify(name, { lower: true, locale: "fr" });
}

export async function createCategory(
  name: string,
  description: string,
  isIncome: boolean
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const slug = generateSlug(name);

  const existing = await prisma.category.findUnique({
    where: { userId_slug: { userId: session.user.id, slug } },
  });

  if (existing) throw new Error("Une catégorie avec ce nom existe déjà");

  await prisma.category.create({
    data: {
      userId: session.user.id,
      name,
      slug,
      description: description || null,
      isIncome,
      isSystem: false,
    },
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function updateCategory(
  categoryId: string,
  name: string,
  description: string,
  isIncome: boolean
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: session.user.id, isSystem: false },
  });

  if (!category) throw new Error("Catégorie non trouvée");

  const slug = generateSlug(name);

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      name,
      slug,
      description: description || null,
      isIncome,
    },
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function deleteCategory(categoryId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: session.user.id, isSystem: false },
  });

  if (!category) throw new Error("Catégorie non trouvée");

  await prisma.transaction.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });

  await prisma.categorizationRule.deleteMany({
    where: { categoryId },
  });

  await prisma.category.delete({
    where: { id: categoryId },
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/rules");
}
