"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Tags,
  ListChecks,
  Landmark,
  Settings,
  LogOut,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronsUpDown,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { siteConfig } from "@/config";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";


interface Account {
  id: string;
  name: string;
  bankName: string | null;
  _count: { transactions: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  isIncome: boolean;
  _count: { transactions: number };
}

interface User {
  name: string | null;
  image: string | null | undefined;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface AppSidebarProps {
  accounts: Account[];
  categories: Category[];
  user?: User;
  workspace?: WorkspaceInfo;
  members?: Member[];
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function NavContent({ accounts, categories, user, workspace, members }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategoryId = searchParams.get("category");
  const activeAccountId = searchParams.get("account");

  const [accountsOpen, setAccountsOpen] = useState(() =>
    pathname === "/accounts" || pathname.startsWith("/accounts/")
  );
  const [transactionsOpen, setTransactionsOpen] = useState(() =>
    pathname === "/transactions" || pathname.startsWith("/transactions/")
  );

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isTransactionsActive = isActive("/transactions");
  const isAccountsActive = isActive("/accounts");

  const expenseCategories = categories.filter((c) => !c.isIncome);
  const incomeCategories = categories.filter((c) => c.isIncome);

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarRail />

      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
                <Landmark className="size-4 text-sidebar-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">
                {siteConfig.name}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-medium text-sidebar-foreground/40 uppercase tracking-widest px-2 mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent className="font-heading">
            <SidebarMenu>

              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")} tooltip="Dashboard">
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-[15px] shrink-0" data-icon="inline-start" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Transactions (collapsible) */}
              <Collapsible open={transactionsOpen} onOpenChange={setTransactionsOpen} asChild>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isTransactionsActive} tooltip="Transactions">
                      <Receipt className="size-[15px] shrink-0" data-icon="inline-start" />
                      <span>Transactions</span>
                      <ChevronRight
                        className="ml-auto size-3.5 shrink-0 transition-transform duration-200"
                        style={{ transform: transactionsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>

                      {/* Toutes */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          size="sm"
                          isActive={isTransactionsActive && !activeCategoryId}
                        >
                          <Link href="/transactions" className="flex items-center gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded border border-sidebar-border/60 bg-sidebar-accent text-sidebar-foreground/50">
                              <span className="text-[9px] leading-none">⋯</span>
                            </span>
                            <span>Toutes</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Catégories dépenses */}
                      {expenseCategories.length > 0 && (
                        <>
                          <li className="px-2 pt-2 pb-0.5">
                            <span className="flex items-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-widest text-sidebar-foreground/30">
                              <ArrowDownLeft className="size-2.5" />
                              Dépenses
                            </span>
                          </li>
                          {expenseCategories.map((cat) => (
                            <SidebarMenuSubItem key={cat.id}>
                              <SidebarMenuSubButton
                                asChild
                                size="sm"
                                isActive={activeCategoryId === cat.id}
                              >
                                <Link href={`/transactions?category=${cat.id}`} className="flex items-center gap-2">
                                  <span
                                    className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                    style={{ backgroundColor: cat.color ?? "oklch(0.708 0 0)" }}
                                  />
                                  <span className="truncate">{cat.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                              {cat._count.transactions > 0 && (
                                <SidebarMenuBadge className="text-sidebar-foreground/40">
                                  {cat._count.transactions}
                                </SidebarMenuBadge>
                              )}
                            </SidebarMenuSubItem>
                          ))}
                        </>
                      )}

                      {/* Catégories revenus */}
                      {incomeCategories.length > 0 && (
                        <>
                          <li className="px-2 pt-2 pb-0.5">
                            <span className="flex items-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-widest text-sidebar-foreground/30">
                              <ArrowUpRight className="size-2.5" />
                              Revenus
                            </span>
                          </li>
                          {incomeCategories.map((cat) => (
                            <SidebarMenuSubItem key={cat.id}>
                              <SidebarMenuSubButton
                                asChild
                                size="sm"
                                isActive={activeCategoryId === cat.id}
                              >
                                <Link href={`/transactions?category=${cat.id}`} className="flex items-center gap-2">
                                  <span
                                    className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                    style={{ backgroundColor: cat.color ?? "oklch(0.708 0 0)" }}
                                  />
                                  <span className="truncate">{cat.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                              {cat._count.transactions > 0 && (
                                <SidebarMenuBadge className="text-sidebar-foreground/40">
                                  {cat._count.transactions}
                                </SidebarMenuBadge>
                              )}
                            </SidebarMenuSubItem>
                          ))}
                        </>
                      )}

                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Imports */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/imports")} tooltip="Imports">
                  <Link href="/imports">
                    <Upload className="size-[15px] shrink-0" data-icon="inline-start" />
                    <span>Imports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Catégories */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/categories")} tooltip="Catégories">
                  <Link href="/categories">
                    <Tags className="size-[15px] shrink-0" data-icon="inline-start" />
                    <span>Catégories</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Règles */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/rules")} tooltip="Règles">
                  <Link href="/rules">
                    <ListChecks className="size-[15px] shrink-0" data-icon="inline-start" />
                    <span>Règles</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Comptes (collapsible) */}
              <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen} asChild>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isAccountsActive} tooltip="Comptes">
                      <Landmark className="size-[15px] shrink-0" data-icon="inline-start" />
                      <span>Comptes</span>
                      <ChevronRight
                        className="ml-auto size-3.5 shrink-0 transition-transform duration-200"
                        style={{ transform: accountsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>

                      {/* Tous les comptes */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          size="sm"
                          isActive={isAccountsActive && !activeAccountId}
                        >
                          <Link href="/accounts" className="flex items-center gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded border border-sidebar-border/60 bg-sidebar-accent text-sidebar-foreground/50">
                              <span className="text-[9px] leading-none">⋯</span>
                            </span>
                            <span>Tous</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {accounts.map((account) => (
                        <SidebarMenuSubItem key={account.id}>
                          <SidebarMenuSubButton
                            asChild
                            size="sm"
                            isActive={activeAccountId === account.id}
                          >
                            <Link href={`/transactions?account=${account.id}`} className="flex items-center gap-2">
                              <span className="flex size-4 shrink-0 items-center justify-center rounded bg-sidebar-primary/10 text-sidebar-primary text-[9px] font-semibold leading-none">
                                {getInitials(account.name)}
                              </span>
                              <span className="truncate">{account.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          {account._count.transactions > 0 && (
                            <SidebarMenuBadge className="text-sidebar-foreground/40">
                              {account._count.transactions}
                            </SidebarMenuBadge>
                          )}
                        </SidebarMenuSubItem>
                      ))}

                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Paramètres */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Paramètres">
                  <Link href="/settings">
                    <Settings className="size-[15px] shrink-0" data-icon="inline-start" />
                    <span>Paramètres</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-10 gap-2.5">
                  <Avatar size="sm">
                    <AvatarImage src={user?.image ?? undefined} />
                    <AvatarFallback>{getInitials(user?.name ?? "U")}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-xs font-medium truncate text-left">
                    {user?.name ?? "Utilisateur"}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {user?.name ?? "Utilisateur"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="size-3.5 mr-2" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-3.5 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Suspense
      fallback={
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarRail />
        </Sidebar>
      }
    >
      <NavContent {...props} />
    </Suspense>
  );
}
