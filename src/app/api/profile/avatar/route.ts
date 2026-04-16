import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deleteAvatar } from "@/lib/avatar-storage";
import { prisma } from "@/lib/auth";

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

  await prisma.userSettings.update({
    where: { userId },
    data: { avatarProvider: null, avatarKey: null },
  });

  return Response.json({ url: null });
}