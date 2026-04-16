import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getWorkspaceContext } from "@/lib/workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { siteConfig } from "@/config";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    session = null;
  }

  if (!session) {
    redirect("/login");
  }

  const ctx = await getWorkspaceContext();

  const [accounts, categories, members] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        bankName: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { OR: [{ workspaceId: ctx.workspaceId }, { isSystem: true }] },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        icon: true,
        isIncome: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="flex h-full w-full">
          <AppSidebar
            accounts={accounts}
            categories={categories}
            user={{ name: ctx.membership.user.name, image: ctx.membership.user.image }}
            workspace={{ id: ctx.workspaceId, name: ctx.workspace.name, type: ctx.workspace.type, role: ctx.role }}
            members={members.map((m) => ({
              id: m.id,
              userId: m.userId,
              role: m.role,
              user: {
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
                image: m.user.image,
              },
            }))}
          />
          <SidebarInset className="flex-1 flex flex-col overflow-hidden h-screen">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden bg-background">
              <SidebarTrigger />
              <span className="text-sm text-foreground tracking-tight">
                {siteConfig.name}
              </span>
            </header>
            <div className="flex-1 overflow-y-auto">
              <main className="px-6 pt-6 pb-6 md:pt-0 md:pb-8">{children}</main>
            </div>
          </SidebarInset>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
