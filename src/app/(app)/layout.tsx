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
import { normalizeAppLocale } from "@/lib/locale";
import { headers } from "next/headers";
import { siteConfig } from "@/config";
import { buildLogoUrlFromBrandDomain } from "@/lib/bank-logo-resolver";

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

  const [accounts, categories, members, userSettings] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        bankName: true,
        bankInstitutionId: true,
        bankBrandDomain: true,
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
    prisma.userSettings.findUnique({
      where: { userId: ctx.userId },
      select: { locale: true },
    }),
  ]);
  const locale = normalizeAppLocale(userSettings?.locale ?? siteConfig.locale);

  const sidebarBrandLogos: Record<string, string> = {};
  for (const acc of accounts) {
    if (acc.bankInstitutionId && acc.bankBrandDomain) {
      const url = buildLogoUrlFromBrandDomain(acc.bankBrandDomain);
      if (url) sidebarBrandLogos[acc.bankInstitutionId] = url;
    }
  }

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="flex h-full w-full">
          <AppSidebar
            accounts={accounts}
            categories={categories}
            locale={locale}
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
            initialBrandLogos={sidebarBrandLogos}
          />
          <SidebarInset className="flex-1 flex flex-col overflow-hidden h-screen">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden bg-background">
              <SidebarTrigger />
              <span className="text-sm text-foreground tracking-tight">
                {siteConfig.name}
              </span>
            </header>
            <div className="flex-1 flex flex-col overflow-hidden">
              <main className="flex-1 min-h-0 overflow-y-auto flex flex-col px-6 pt-6 pb-6 md:pt-0 md:pb-8">{children}</main>
            </div>
          </SidebarInset>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
