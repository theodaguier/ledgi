import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { MatchType } from "@prisma/client";

const VALID_MATCH_TYPES = new Set(Object.values(MatchType));

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "rules.write");
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

  if (!body) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  if (body.matchType && !VALID_MATCH_TYPES.has(body.matchType)) {
    return Response.json(
      { error: `Invalid matchType. Must be one of: ${[...VALID_MATCH_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  if (body.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: body.categoryId, OR: [{ workspaceId }, { isSystem: true }] },
    });
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }
  }

  const updated = await prisma.categorizationRule.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.matchType !== undefined && { matchType: body.matchType as MatchType }),
      ...(body.pattern !== undefined && { pattern: body.pattern }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return Response.json({
    id: updated.id,
    name: updated.name,
    priority: updated.priority,
    matchType: updated.matchType,
    pattern: updated.pattern,
    description: updated.description,
    isActive: updated.isActive,
    category: updated.category,
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
    requireScope(authCtx, "rules.write");
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

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  await prisma.categorizationRule.delete({ where: { id } });

  return Response.json({ success: true });
}
