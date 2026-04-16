"use client";

import type { DateRange } from "react-day-picker";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { updateTransactionCategory } from "@/actions/transactions";
import { getTransactionAmountDisplay } from "@/lib/transaction-amount";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownUp,
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  Layers,
  Loader2,
  Search,
  Tag,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { CategoryIcon } from "@/lib/category-icon";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  formatDateParam,
  parseDateParam,
  type TransactionDatePreset,
  type TransactionSort,
} from "./filter-utils";

interface OwnerUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Transaction {
  id: string;
  dateOperation: Date | string;
  label: string;
  labelNormalized: string | null;
  merchant: string | null;
  amount: number;
  currency: string;
  type: string;
  confidence: number;
  category: { id: string; name: string; slug: string; color: string | null; icon: string | null } | null;
  bankAccount: { id: string; name: string };
  ownerUser: OwnerUser | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

export default function TransactionsTable({
  transactions,
  categories,
  searchParams,
  members,
}: {
  transactions: Transaction[];
  categories: Category[];
  searchParams: {
    q?: string;
    category?: string;
    preset?: TransactionDatePreset;
    from?: string;
    to?: string;
    sort: TransactionSort;
    account?: string;
    user?: string;
  };
  members?: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [, startFilterTransition] = useTransition();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const searchTimeoutRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useOptimistic(searchParams.q ?? "");
  const [filterCategory, setFilterCategory] = useOptimistic(
    searchParams.category ?? "all"
  );
  const [datePreset, setDatePreset] = useOptimistic<
    TransactionDatePreset | "all" | "custom"
  >(
    searchParams.preset ??
      (searchParams.from || searchParams.to ? "custom" : "all")
  );
  const [sortOrder, setSortOrder] = useOptimistic<TransactionSort>(
    searchParams.sort
  );
  const [customRange, setCustomRange] = useOptimistic<{
    from?: string;
    to?: string;
  }>({
    from: searchParams.from,
    to: searchParams.to,
  });
  const [filterUser, setFilterUser] = useOptimistic(
    searchParams.user ?? "all"
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const replaceSearchParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    update(params);

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }
  };

  const selectedRange: DateRange | undefined =
    customRange.from || customRange.to
      ? {
          from: parseDateParam(customRange.from),
          to: parseDateParam(customRange.to),
        }
      : undefined;

  const customRangeLabel = (() => {
    const from = parseDateParam(customRange.from);
    const to = parseDateParam(customRange.to);

    if (from && to) {
      return `${format(from, "dd/MM/yyyy", { locale: fr })} – ${format(
        to,
        "dd/MM/yyyy",
        { locale: fr }
      )}`;
    }

    if (from) {
      return format(from, "dd/MM/yyyy", { locale: fr });
    }

    return "Période perso";
  })();

  const activeDateLabel =
    datePreset === "today"
      ? "Aujourd'hui"
      : datePreset === "last7d"
      ? "7 derniers jours"
      : datePreset === "month"
      ? "Ce mois"
      : customRange.from
      ? customRangeLabel
      : undefined;

  const activeCategoryName =
    filterCategory === "all"
      ? null
      : filterCategory === "uncategorized"
      ? "Non catégorisé"
      : (categories.find((c) => c.id === filterCategory)?.name ?? null);

  const activeUserName =
    filterUser === "all"
      ? null
      : members?.find((m) => m.userId === filterUser)?.user.name ?? null;

  const hasActiveFilters =
    filterCategory !== "all" || datePreset !== "all" || !!customRange.from || filterUser !== "all";

  const handleSearchChange = (value: string) => {
    startFilterTransition(() => setSearchQuery(value));

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      startFilterTransition(() => {
        replaceSearchParams((params) => {
          const trimmedQuery = value.trim();

          if (trimmedQuery) {
            params.set("q", trimmedQuery);
          } else {
            params.delete("q");
          }
        });
      });
    }, 250);
  };

  const handleCategoryFilterChange = (value: string) => {
    startFilterTransition(() => {
      setFilterCategory(value);
      replaceSearchParams((params) => {
        if (value === "all") {
          params.delete("category");
        } else {
          params.set("category", value);
        }
      });
    });
  };

  const handleDatePresetChange = (value: TransactionDatePreset | "all") => {
    startFilterTransition(() => {
      setDatePreset(value);
      setCustomRange({});
      replaceSearchParams((params) => {
        params.delete("from");
        params.delete("to");

        if (value === "all") {
          params.delete("preset");
        } else {
          params.set("preset", value);
        }
      });
    });
  };

  const handleSortChange = (value: string) => {
    const nextValue = (value === "asc" ? "asc" : "desc") as TransactionSort;
    startFilterTransition(() => {
      setSortOrder(nextValue);
      replaceSearchParams((params) => {
        if (nextValue === "desc") {
          params.delete("sort");
        } else {
          params.set("sort", nextValue);
        }
      });
    });
  };

  const handleUserFilterChange = (value: string) => {
    startFilterTransition(() => {
      setFilterUser(value);
      replaceSearchParams((params) => {
        if (value === "all") {
          params.delete("user");
        } else {
          params.set("user", value);
        }
      });
    });
  };

  const clearDateFilter = () => {
    startFilterTransition(() => {
      setDatePreset("all");
      setCustomRange({});
      replaceSearchParams((params) => {
        params.delete("preset");
        params.delete("from");
        params.delete("to");
      });
    });
  };

  const clearAllFilters = () => {
    startFilterTransition(() => {
      setFilterCategory("all");
      setDatePreset("all");
      setCustomRange({});
      setFilterUser("all");
      replaceSearchParams((params) => {
        params.delete("category");
        params.delete("preset");
        params.delete("from");
        params.delete("to");
        params.delete("user");
      });
    });
  };

  const handleCustomRangeChange = (range: DateRange | undefined) => {
    const nextRange = {
      from: range?.from ? formatDateParam(range.from) : undefined,
      to: range?.to ? formatDateParam(range.to) : undefined,
    };

    startFilterTransition(() => {
      setDatePreset("custom");
      setCustomRange(nextRange);
      replaceSearchParams((params) => {
        params.delete("preset");

        if (nextRange.from) {
          params.set("from", nextRange.from);
        } else {
          params.delete("from");
        }

        if (nextRange.to) {
          params.set("to", nextRange.to);
        } else {
          params.delete("to");
        }
      });
    });
  };

  const handleCategoryChange = (txId: string, categoryId: string | null) => {
    startTransition(async () => {
      try {
        await updateTransactionCategory(
          txId,
          categoryId === "none" ? null : categoryId
        );
        toast.success("Catégorie mise à jour");
        setEditingTx(null);
        router.refresh();
      } catch {
        toast.error("Erreur lors de la mise à jour");
      }
    });
  };

  const editingTxAmountDisplay = editingTx
    ? getTransactionAmountDisplay(
        editingTx.amount,
        editingTx.type,
        editingTx.currency
      )
    : null;

  const hasMultipleMembers = (members?.length ?? 0) > 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="sticky top-0 z-20 bg-background pt-6 md:pt-8 pb-4 flex flex-col gap-2">
        {/* Search + filter pills */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher par libellé, marchand…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={filterCategory !== "all" ? "secondary" : "outline"}>
                <Tag data-icon="inline-start" />
                {activeCategoryName ?? "Catégorie"}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Catégorie</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={filterCategory}
                onValueChange={handleCategoryFilterChange}
              >
                <DropdownMenuRadioItem value="all">
                  Toutes catégories
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="uncategorized">
                  Non catégorisé
                </DropdownMenuRadioItem>
                {categories.length > 0 && <DropdownMenuSeparator />}
                {categories.map((cat) => (
                  <DropdownMenuRadioItem key={cat.id} value={cat.id}>
                    <span
                      className="size-4 shrink-0 flex items-center justify-center rounded-sm"
                      style={cat.color ? { backgroundColor: cat.color + "22" } : undefined}
                    >
                      <CategoryIcon
                        icon={cat.icon}
                        className="size-3"
                        style={cat.color ? { color: cat.color } : undefined}
                      />
                    </span>
                    {cat.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User pill — only show when multiple members */}
          {hasMultipleMembers && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={filterUser !== "all" ? "secondary" : "outline"}>
                  <User data-icon="inline-start" />
                  {activeUserName ?? "Membre"}
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Membre</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterUser}
                  onValueChange={handleUserFilterChange}
                >
                  <DropdownMenuRadioItem value="all">
                    Tous les membres
                  </DropdownMenuRadioItem>
                  {members?.map((member) => (
                    <DropdownMenuRadioItem
                      key={member.userId}
                      value={member.userId}
                    >
                      {member.user.name ?? member.user.email}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Date pill */}
          <Popover
            open={isDatePopoverOpen}
            onOpenChange={(open) => {
              if (open) setPendingRange(undefined);
              setIsDatePopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button variant={datePreset !== "all" || customRange.from ? "secondary" : "outline"}>
                <CalendarDays data-icon="inline-start" />
                {activeDateLabel ?? "Période"}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex gap-1 p-2 border-b border-border">
                {(
                  [
                    { value: "today", label: "Aujourd'hui" },
                    { value: "last7d", label: "7 jours" },
                    { value: "month", label: "Ce mois" },
                  ] as { value: TransactionDatePreset; label: string }[]
                ).map(({ value, label }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={datePreset === value ? "secondary" : "ghost"}
                    onClick={() => {
                      handleDatePresetChange(value);
                      setIsDatePopoverOpen(false);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Début</span>
                  <span className={cn("text-sm font-medium tabular-nums", !pendingRange?.from && "text-muted-foreground")}>
                    {pendingRange?.from ? format(pendingRange.from, "dd MMM yyyy", { locale: fr }) : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Fin</span>
                  <span className={cn("text-sm font-medium tabular-nums", !pendingRange?.to && "text-muted-foreground")}>
                    {pendingRange?.to
                      ? format(pendingRange.to, "dd MMM yyyy", { locale: fr })
                      : pendingRange?.from ? "Choisir…" : "—"}
                  </span>
                </div>
              </div>
              <Calendar
                mode="range"
                locale={fr}
                selected={pendingRange}
                onSelect={setPendingRange}
                numberOfMonths={2}
              />
              <div className="flex items-center justify-between border-t border-border p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!pendingRange?.from && !customRange.from && datePreset === "all"}
                  onClick={() => {
                    clearDateFilter();
                    setPendingRange(undefined);
                    setIsDatePopoverOpen(false);
                  }}
                >
                  Effacer
                </Button>
                <Button
                  size="sm"
                  disabled={!pendingRange?.from}
                  onClick={() => {
                    if (pendingRange) handleCustomRangeChange(pendingRange);
                    setIsDatePopoverOpen(false);
                  }}
                >
                  Appliquer
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowDownUp data-icon="inline-start" />
                {sortOrder === "desc" ? "Plus récentes" : "Plus anciennes"}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Trier par date</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortOrder}
                onValueChange={handleSortChange}
              >
                <DropdownMenuRadioItem value="desc">
                  Plus récentes
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="asc">
                  Plus anciennes
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active filter chips + result count */}
        {(hasActiveFilters || transactions.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasActiveFilters && (
              <>
                {activeCategoryName && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleCategoryFilterChange("all")}
                  >
                    {activeCategoryName}
                    <X />
                  </Badge>
                )}
                {activeUserName && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleUserFilterChange("all")}
                  >
                    {activeUserName}
                    <X />
                  </Badge>
                )}
                {activeDateLabel && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={clearDateFilter}
                  >
                    {activeDateLabel}
                    <X />
                  </Badge>
                )}
                <Button variant="ghost" size="xs" onClick={clearAllFilters}>
                  Tout effacer
                </Button>
              </>
            )}
            {transactions.length > 0 && (
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  hasActiveFilters && "ml-auto"
                )}
              >
                {transactions.length} transaction
                {transactions.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-4 p-0" />
              <TableHead className="w-24 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Libellé</TableHead>
              <TableHead className="w-36 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Catégorie</TableHead>
              <TableHead className="w-28 hidden sm:table-cell text-xs uppercase tracking-wider font-semibold text-muted-foreground">Compte</TableHead>
              {hasMultipleMembers && (
                <TableHead className="w-28 hidden lg:table-cell text-xs uppercase tracking-wider font-semibold text-muted-foreground">Membre</TableHead>
              )}
              <TableHead className="w-32 text-right text-xs uppercase tracking-wider font-semibold text-muted-foreground">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasMultipleMembers ? 7 : 6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="size-8 text-muted-foreground/30" />
                    <span className="text-muted-foreground text-sm">
                      Aucune transaction
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                const amountDisplay = getTransactionAmountDisplay(
                  tx.amount,
                  tx.type,
                  tx.currency
                );

                const typeColor =
                  tx.type === "CREDIT"
                    ? "bg-green-500"
                    : tx.type === "DEBIT"
                    ? "bg-destructive"
                    : "bg-muted-foreground";

                const TypeIcon =
                  tx.type === "CREDIT"
                    ? TrendingUp
                    : tx.type === "DEBIT"
                    ? TrendingDown
                    : ArrowLeftRight;

                return (
                  <TableRow
                    key={tx.id}
                    className="cursor-pointer group"
                    onClick={() => setEditingTx(tx)}
                  >
                    {/* Type indicator bar */}
                    <TableCell className="p-0 w-4">
                      <div className={cn("w-0.5 h-full min-h-[3rem] mx-auto", typeColor)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-xs py-3">
                      {format(new Date(tx.dateOperation), "dd MMM", { locale: fr })}
                      <span className="block text-muted-foreground/50 text-[10px]">
                        {format(new Date(tx.dateOperation), "yyyy")}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "shrink-0 size-7 flex items-center justify-center",
                          tx.type === "CREDIT"
                            ? "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400"
                            : tx.type === "DEBIT"
                            ? "bg-destructive/8 text-destructive"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <TypeIcon className="size-3.5" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate max-w-xs text-sm font-medium leading-tight">
                            {tx.merchant ?? tx.label}
                          </span>
                          {tx.merchant && (
                            <span className="text-xs text-muted-foreground truncate max-w-xs leading-tight">
                              {tx.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        {tx.category ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span
                              className="size-5 shrink-0 flex items-center justify-center"
                              style={tx.category.color ? { backgroundColor: tx.category.color + "22" } : undefined}
                            >
                              <CategoryIcon
                                icon={tx.category.icon}
                                className="size-3"
                                style={tx.category.color ? { color: tx.category.color } : undefined}
                              />
                            </span>
                            <span className="text-foreground font-medium">
                              {tx.category.name}
                            </span>
                            {tx.confidence > 0 && tx.confidence < 0.7 && (
                              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                {Math.round(tx.confidence * 100)}%
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-5 shrink-0 flex items-center justify-center bg-muted">
                              <Layers className="size-3" />
                            </span>
                            Non catégorisé
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-3">
                      {tx.bankAccount.name}
                    </TableCell>
                    {hasMultipleMembers && (
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell py-3">
                        {tx.ownerUser ? (
                          <div className="flex items-center gap-1.5">
                            <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-medium">
                                {tx.ownerUser.name?.[0]?.toUpperCase() ?? tx.ownerUser.email[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="truncate">
                              {tx.ownerUser.name ?? tx.ownerUser.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="py-3">
                      <div className={cn(
                        "text-right font-semibold tabular-nums text-sm",
                        amountDisplay.className
                      )}>
                        {amountDisplay.prefix}
                        {amountDisplay.value}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editingTx} onOpenChange={() => setEditingTx(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier la transaction</SheetTitle>
          </SheetHeader>
          {editingTx && (
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{editingTx.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(editingTx.dateOperation), "dd MMMM yyyy")} ·{" "}
                  <span
                    className={cn(
                      "font-medium",
                      editingTxAmountDisplay?.className
                    )}
                  >
                    {editingTxAmountDisplay?.prefix}
                    {editingTxAmountDisplay?.value}
                  </span>
                </p>
                {editingTx.merchant && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editingTx.merchant}
                  </p>
                )}
                {editingTx.ownerUser && hasMultipleMembers && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Importé par {editingTx.ownerUser.name ?? editingTx.ownerUser.email}
                  </p>
                )}
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="transaction-category">
                    Catégorie
                  </FieldLabel>
                  <Select
                    value={editingTx.category?.id ?? "none"}
                    onValueChange={(val) =>
                      handleCategoryChange(
                        editingTx.id,
                        val === "none" ? null : (val ?? null)
                      )
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="transaction-category">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non catégorisé</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              {isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Mise à jour en cours…
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
