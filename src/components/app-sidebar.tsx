"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Tags,
  ListChecks,
  Landmark,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { toast } from "sonner";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Transactions",
    href: "/transactions",
    icon: Receipt,
  },
  {
    title: "Imports",
    href: "/imports",
    icon: Upload,
  },
  {
    title: "Catégories",
    href: "/categories",
    icon: Tags,
  },
  {
    title: "Règles",
    href: "/rules",
    icon: ListChecks,
  },
  {
    title: "Comptes",
    href: "/accounts",
    icon: Landmark,
  },
  {
    title: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarRail />
      <SidebarHeader className="border-b border-sidebar-border px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-sidebar-primary">
            <Landmark className="size-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">
            Finance
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-medium text-sidebar-foreground/40 uppercase tracking-widest px-2 mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 w-full text-sm transition-all rounded-lg px-2 py-1.5",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon
                            className="size-[15px] shrink-0"
                            data-icon="inline-start"
                          />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm px-2 py-1.5 h-auto rounded-lg"
          onClick={handleSignOut}
        >
          <LogOut className="size-[15px]" data-icon="inline-start" />
          <span>Déconnexion</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
