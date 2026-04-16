import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "categories.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.category.findFirst({
    where: { id, workspaceId, isSystem: false },
  });

  if (!existing) {
    return Response.json({ error: "Category not found or is a system category" }, { status: 404 });
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name, slug: generateSlug(body.name) }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isIncome !== undefined && { isIncome: body.isIncome }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.color !== undefined && { color: body.color }),
    },
  });

  return Response.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    color: updated.color,
    icon: updated.icon,
    isSystem: updated.isSystem,
    isIncome: updated.isIncome,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "categories.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;

  const existing = await prisma.category.findFirst({
    where: { id, workspaceId, isSystem: false },
  });

  if (!existing) {
    return Response.json({ error: "Category not found or is a system category" }, { status: 404 });
  }

  await prisma.transaction.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });

  await prisma.categorizationRule.deleteMany({
    where: { categoryId: id },
  });

  await prisma.category.delete({ where: { id } });

  return Response.json({ success: true });
}
