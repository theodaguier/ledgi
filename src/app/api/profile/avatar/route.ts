import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadAvatar, deleteAvatar } from "@/lib/avatar-storage";
import { validateAvatarFile } from "@/lib/avatar-storage";
import { prisma } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  try {
    validateAvatarFile({ size: file.size, type: file.type });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid file" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadAvatar(buffer, file.name, file.type);

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { avatarProvider: true, avatarKey: true },
  });

  if (settings?.avatarKey && settings?.avatarProvider === "local") {
    await deleteAvatar(settings.avatarKey).catch(() => {});
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { avatarProvider: result.provider, avatarKey: result.key },
    create: { userId, avatarProvider: result.provider, avatarKey: result.key },
  });

  return Response.json({ url: result.url });
}

export async function DELETE(_request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { avatarProvider: true, avatarKey: true },
  });

  if (settings?.avatarKey && settings?.avatarProvider === "local") {
    await deleteAvatar(settings.avatarKey).catch(() => {});
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { avatarProvider: null, avatarKey: null },
    create: { userId, avatarProvider: null, avatarKey: null },
  });

  return Response.json({ url: null });
}