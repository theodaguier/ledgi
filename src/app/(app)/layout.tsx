import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

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

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="flex h-full w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 min-h-screen flex flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden bg-background">
              <SidebarTrigger />
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Finance
              </span>
            </header>
            <main className="flex-1 px-6 py-6 md:py-8">{children}</main>
          </SidebarInset>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
