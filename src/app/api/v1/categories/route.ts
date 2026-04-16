import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name
  ) {
    return Response.json({ error: "Invalid body: name required" }, { status: 400 });
  }

  const slug = generateSlug(body.name);

  const existing = await prisma.category.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
  });

  if (existing) {
    return Response.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }

  const category = await prisma.category.create({
    data: {
      workspaceId,
      name: body.name,
      slug,
      description: body.description ?? null,
      isIncome: body.isIncome ?? false,
      isSystem: false,
      icon: body.icon ?? null,
      color: body.color ?? null,
    },
  });

  return Response.json({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    color: category.color,
    icon: category.icon,
    isSystem: category.isSystem,
    isIncome: category.isIncome,
    createdAt: category.createdAt.toISOString(),
  }, { status: 201 });
}
