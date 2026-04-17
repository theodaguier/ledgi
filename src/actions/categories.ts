"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { getWorkspaceContext } from "@/lib/workspace";
import { categoryFormSchema } from "@/lib/validation/schemas";

function generateSlug(name: string): string {
  return slugify(name, { lower: true, locale: "fr" });
}

export async function createCategory(
  name: string,
  description: string,
  isIncome: boolean,
  icon?: string,
  color?: string
) {
  const parsed = categoryFormSchema.safeParse({ name, description, isIncome, icon, color });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const ctx = await getWorkspaceContext();

  const slug = generateSlug(name);

  const existing = await prisma.category.findUnique({
    where: { workspaceId_slug: { workspaceId: ctx.workspaceId, slug } },
  });

  if (existing) throw new Error("Une catégorie avec ce nom existe déjà");

  await prisma.category.create({
    data: {
      workspaceId: ctx.workspaceId,
      name,
      slug,
      description: description || null,
      isIncome,
      isSystem: false,
      icon: icon || null,
      color: color || null,
    },
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function updateCategory(
  categoryId: string,
  name: string,
  description: string,
  isIncome: boolean,
  icon?: string,
  color?: string
) {
  const parsed = categoryFormSchema.safeParse({ name, description, isIncome, icon, color });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const ctx = await getWorkspaceContext();

  const category = await prisma.category.findFirst({
    where: { id: categoryId, workspaceId: ctx.workspaceId, isSystem: false },
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
      icon: icon || null,
      color: color || null,
    },
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function deleteCategory(categoryId: string) {
  const ctx = await getWorkspaceContext();

  const category = await prisma.category.findFirst({
    where: { id: categoryId, workspaceId: ctx.workspaceId, isSystem: false },
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
