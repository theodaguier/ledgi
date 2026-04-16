import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { MatchType } from "@prisma/client";

const VALID_MATCH_TYPES = new Set(Object.values(MatchType));

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.pattern !== "string" ||
    typeof body.categoryId !== "string"
  ) {
    return Response.json(
      { error: "Invalid body: name, pattern, categoryId required" },
      { status: 400 }
    );
  }

  if (body.matchType && !VALID_MATCH_TYPES.has(body.matchType)) {
    return Response.json(
      { error: `Invalid matchType. Must be one of: ${[...VALID_MATCH_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  const category = await prisma.category.findFirst({
    where: {
      id: body.categoryId,
      OR: [{ workspaceId }, { isSystem: true }],
    },
  });

  if (!category) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  const existingCount = await prisma.categorizationRule.count({
    where: { workspaceId },
  });

  const rule = await prisma.categorizationRule.create({
    data: {
      workspaceId,
      name: body.name,
      matchType: (body.matchType as MatchType) || "CONTAINS",
      pattern: body.pattern,
      categoryId: body.categoryId,
      description: body.description || null,
      priority: existingCount,
      isActive: true,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return Response.json({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    matchType: rule.matchType,
    pattern: rule.pattern,
    description: rule.description,
    isActive: rule.isActive,
    category: rule.category,
    createdAt: rule.createdAt.toISOString(),
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (!body || typeof body.id !== "string") {
    return Response.json({ error: "Invalid body: id required" }, { status: 400 });
  }

  const existing = await prisma.categorizationRule.findFirst({
    where: { id: body.id, workspaceId },
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
    where: { id: body.id },
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

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Query param id required" }, { status: 400 });
  }

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  await prisma.categorizationRule.delete({ where: { id } });

  return Response.json({ success: true });
}
