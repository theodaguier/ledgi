import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/auth";

const ALLOWED_SCOPES = new Set([
  "transactions.read",
  "summary.read",
  "accounts.read",
  "categories.read",
  "imports.read",
  "rules.read",
  "transactions.write",
  "rules.write",
  "accounts.write",
  "categories.write",
  "imports.create",
  "imports.delete",
] as const);

export type Scope =
  | "transactions.read"
  | "summary.read"
  | "accounts.read"
  | "categories.read"
  | "imports.read"
  | "rules.read"
  | "transactions.write"
  | "rules.write"
  | "accounts.write"
  | "categories.write"
  | "imports.create"
  | "imports.delete";

export interface ApiKeyContext {
  userId: string;
  apiKeyId: string;
  scopes: Scope[];
}

function generateKey(): { raw: string; prefix: string; hash: string } {
  const raw = `fk_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12);
  const keyHash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash: keyHash };
}

export async function createApiKey(
  userId: string,
  workspaceId: string,
  name: string,
  scopes: Scope[],
  options?: { expiresAt?: Date }
): Promise<{ raw: string; key: { id: string; name: string; prefix: string; scopes: Scope[]; expiresAt: Date | null; createdAt: Date } }> {
  for (const s of scopes) {
    if (!ALLOWED_SCOPES.has(s)) {
      throw new Error(`Invalid scope: ${s}`);
    }
  }

  const { raw, prefix, hash } = generateKey();

  const key = await prisma.apiKey.create({
    data: {
      userId,
      workspaceId,
      name,
      prefix,
      keyHash: hash,
      scopes: scopes as string[],
      expiresAt: options?.expiresAt ?? null,
    },
  });

  return {
    raw,
    key: {
      id: key.id,
      name: key.name,
      prefix,
      scopes: key.scopes as Scope[],
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    },
  };
}

export async function verifyApiKey(
  authHeader: string | null
): Promise<ApiKeyContext | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const prefix = token.slice(0, 12);

  const keys = await prisma.apiKey.findMany({
    where: { prefix, isActive: true },
  });

  for (const key of keys) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (tokenHash !== key.keyHash) continue;

    if (key.expiresAt && key.expiresAt < new Date()) return null;

    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: key.userId,
      apiKeyId: key.id,
      scopes: key.scopes as Scope[],
    };
  }

  return null;
}

export function requireScope(ctx: ApiKeyContext, scope: Scope): void {
  if (!ctx.scopes.includes(scope)) {
    throw new ApiScopeError(scope);
  }
}

export class ApiScopeError extends Error {
  constructor(public readonly requiredScope: string) {
    super(`Missing required scope: ${requiredScope}`);
    this.name = "ApiScopeError";
  }
}

export { ALLOWED_SCOPES };
