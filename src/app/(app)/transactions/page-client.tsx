"use client";

import type { DateRange } from "react-day-picker";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { updateTransactionCategory, getTransactionDetails, updateTransactionMetadata, type TransactionDetails } from "@/actions/transactions";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  ArrowDown,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  CalendarDays,
  ChevronDown,
  Layers,
  Loader2,
  Pin,
  PinOff,
  Search,
  Tag,
  TrendingDown,
  TrendingUp,
  User,
  X,
  AlertCircle,
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
import {
  Combobox,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { buttonVariants } from "@/components/ui/button";

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
  note: string | null;
  pinned: boolean;
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
    categories?: string[];
    preset?: TransactionDatePreset;
    from?: string;
    to?: string;
    sort: TransactionSort;
    account?: string;
    users?: string[];
    pinned?: boolean;
  };
  members?: Member[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [, startFilterTransition] = useTransition();
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const editingTx = editingTxId ? (transactions.find((t) => t.id === editingTxId) ?? null) : null;
  const [txDetails, setTxDetails] = useState<TransactionDetails | null>(null);
  const [txDetailsLoading, setTxDetailsLoading] = useState(false);
  const [txDetailsError, setTxDetailsError] = useState<string | null>(null);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const searchTimeoutRef = useRef<number | null>(null);
  const typingRef = useRef(false);
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const searchQuery = searchDraft ?? searchParams.q ?? "";
  const [filterCategories, setFilterCategories] = useOptimistic<string[]>(
    searchParams.categories ?? []
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
  const [filterUsers, setFilterUsers] = useOptimistic<string[]>(
    searchParams.users ?? []
  );
  const [filterPinned, setFilterPinned] = useOptimistic<boolean>(
    searchParams.pinned ?? false
  );

  useEffect(() => {
    if (!editingTxId) {
      startTransition(() => {
        setTxDetails(null);
        setTxDetailsError(null);
      });
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setTxDetailsLoading(true);
      setTxDetailsError(null);
    });
    getTransactionDetails(editingTxId)
      .then((details) => {
        if (!cancelled) {
          startTransition(() => {
            setTxDetails(details);
            setTxDetailsLoading(false);
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          startTransition(() => {
            setTxDetailsError("Impossible de charger les détails");
            setTxDetailsLoading(false);
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editingTxId]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const replaceSearchParams = useCallback((update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    update(params);

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }
  }, [pathname, router]);

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

  const categoryFilterLabel =
    filterCategories.length === 0
      ? "Catégorie"
      : filterCategories.length === 1
        ? filterCategories[0] === "uncategorized"
          ? "Non catégorisé"
          : (categories.find((c) => c.id === filterCategories[0])?.name ?? "Catégorie")
        : `Catégorie · ${filterCategories.length}`;

  const userFilterLabel =
    filterUsers.length === 0
      ? "Membre"
      : filterUsers.length === 1
        ? (members?.find((m) => m.userId === filterUsers[0])?.user.name ?? "Membre")
        : `Membre · ${filterUsers.length}`;

  const hasActiveFilters =
    filterCategories.length > 0 || datePreset !== "all" || !!customRange.from || filterUsers.length > 0 || filterPinned;

  const handleSearchChange = (value: string) => {
    typingRef.current = true;
    setSearchDraft(value);

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      replaceSearchParams((params) => {
        const trimmedQuery = value.trim();

        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        } else {
          params.delete("q");
        }
      });
      typingRef.current = false;
      setSearchDraft(null);
    }, 300);
  };

  const handleCategoryFilterChange = (values: string[]) => {
    startFilterTransition(() => {
      setFilterCategories(values);
      replaceSearchParams((params) => {
        params.delete("categories");
        values.forEach((v) => params.append("categories", v));
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

  const handleUserFilterChange = (values: string[]) => {
    startFilterTransition(() => {
      setFilterUsers(values);
      replaceSearchParams((params) => {
        params.delete("users");
        values.forEach((v) => params.append("users", v));
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
      setFilterCategories([]);
      setDatePreset("all");
      setCustomRange({});
      setFilterUsers([]);
      setFilterPinned(false);
      replaceSearchParams((params) => {
        params.delete("categories");
        params.delete("preset");
        params.delete("from");
        params.delete("to");
        params.delete("users");
        params.delete("pinned");
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
        setEditingTxId(null);
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
    <div className="flex flex-col min-h-0 flex-1 gap-4">
      {/* Filter bar */}
      <div className="shrink-0 pt-6 md:pt-8 pb-4 flex flex-col gap-2">
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

          {/* Category combobox — multi-select */}
          <Combobox
            multiple
            value={filterCategories}
            onValueChange={handleCategoryFilterChange}
          >
            <ComboboxTrigger
              className={cn(
                buttonVariants({
                  variant: filterCategories.length > 0 ? "secondary" : "outline",
                }),
              )}
            >
              <Tag data-icon="inline-start" />
              {categoryFilterLabel}
            </ComboboxTrigger>
            <ComboboxPopup align="end" className="font-heading w-56">
              <ComboboxList>
                <ComboboxItem value="uncategorized">
                  <span className="size-4 shrink-0 flex items-center justify-center rounded-sm bg-muted">
                    <Layers className="size-3 text-muted-foreground" />
                  </span>
                  Non catégorisé
                </ComboboxItem>
                {categories.length > 0 && <ComboboxSeparator />}
                {categories.map((cat) => (
                  <ComboboxItem key={cat.id} value={cat.id}>
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
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxPopup>
          </Combobox>

          {/* User combobox — multi-select, only when multiple members */}
          {hasMultipleMembers && (
            <Combobox
              multiple
              value={filterUsers}
              onValueChange={handleUserFilterChange}
            >
              <ComboboxTrigger
                className={cn(
                  buttonVariants({
                    variant: filterUsers.length > 0 ? "secondary" : "outline",
                  }),
                )}
              >
                <User data-icon="inline-start" />
                {userFilterLabel}
              </ComboboxTrigger>
              <ComboboxPopup align="end" className="font-heading w-48">
                <ComboboxList>
                  {members?.map((member) => (
                    <ComboboxItem key={member.userId} value={member.userId}>
                      {member.user.name ?? member.user.email}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
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
        </div>

        {/* Active filter chips + result count */}
        {(hasActiveFilters || transactions.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasActiveFilters && (
              <>
                {categoryFilterLabel && categoryFilterLabel !== "Catégorie" && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleCategoryFilterChange([])}
                  >
                    {categoryFilterLabel}
                    <X />
                  </Badge>
                )}
                {userFilterLabel && userFilterLabel !== "Membre" && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleUserFilterChange([])}
                  >
                    {userFilterLabel}
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
      <div className="flex-1 min-h-0 border border-border overflow-hidden">
        <div className="overflow-y-auto h-full">
          <Table className="w-full caption-bottom text-sm table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted/30">
              <TableRow className="hover:bg-muted/30">
              <TableHead className="w-4 p-0" />
              <TableHead className="w-24">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 gap-1 px-0 font-heading hover:text-foreground"
                  onClick={() => handleSortChange(sortOrder === "desc" ? "asc" : "desc")}
                >
                  Date
                  {sortOrder === "desc" ? (
                    <ArrowDown className="size-3.5" />
                  ) : sortOrder === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : (
                    <ArrowUpDown className="size-3.5" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="font-heading">Libellé</TableHead>
              <TableHead className="w-36 font-heading">Catégorie</TableHead>
              <TableHead className="w-28 hidden sm:table-cell font-heading">Compte</TableHead>
              {hasMultipleMembers && (
                <TableHead className="w-28 hidden lg:table-cell font-heading">Membre</TableHead>
              )}
              <TableHead className="w-32 text-right font-heading">Montant</TableHead>
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
                    onClick={() => setEditingTxId(tx.id)}
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
      </div>

      {/* Transaction Details Sheet */}
      <Sheet open={!!editingTxId} onOpenChange={() => {
        setEditingTxId(null);
      }}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Détails de la transaction</SheetTitle>
          </SheetHeader>
          {/* Header */}
          {txDetails && (
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="flex flex-col gap-1 min-w-0">
                  <SheetTitle className="truncate">
                    {txDetails.merchant ?? txDetails.label}
                  </SheetTitle>
                  {txDetails.merchant && (
                    <SheetDescription className="truncate">
                      {txDetails.label}
                    </SheetDescription>
                  )}
                  <SheetDescription>
                    {format(new Date(txDetails.dateOperation), "dd MMMM yyyy", { locale: fr })}
                  </SheetDescription>
                </div>
                <span className={cn(
                  "shrink-0 font-semibold tabular-nums",
                  getTransactionAmountDisplay(txDetails.amount, txDetails.type, txDetails.currency).className
                )}>
                  {getTransactionAmountDisplay(txDetails.amount, txDetails.type, txDetails.currency).prefix}
                  {getTransactionAmountDisplay(txDetails.amount, txDetails.type, txDetails.currency).value}
                </span>
              </div>
            </SheetHeader>
          )}

          {/* Loading / Error states */}
          {txDetailsLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {txDetailsError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{txDetailsError}</p>
            </div>
          )}

          {/* Content */}
          {txDetails && !txDetailsLoading && (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant={txDetails.pinned ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      await updateTransactionMetadata(editingTxId!, { pinned: !txDetails.pinned });
                      setTxDetails(prev => prev ? { ...prev, pinned: !prev.pinned } : null);
                    });
                  }}
                >
                  {txDetails.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                  {txDetails.pinned ? "Désépingler" : "Épingler"}
                </Button>
              </div>

              {/* Category */}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="tx-category">Catégorie</FieldLabel>
                  <Select
                    value={editingTx?.category?.id ?? "none"}
                    onValueChange={(val) =>
                      handleCategoryChange(
                        editingTxId!,
                        val === "none" ? null : (val ?? null)
                      )
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="tx-category">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Non catégorisé</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon icon={cat.icon} className="size-3" style={cat.color ? { color: cat.color } : undefined} />
                              {cat.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              {/* Note */}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="tx-note">Note</FieldLabel>
                  <Textarea
                    id="tx-note"
                    value={txDetails.note ?? ""}
                    placeholder="Ajouter une note…"
                    rows={3}
                    className="resize-none"
                    onChange={(e) => {
                      const note = e.target.value || null;
                      startTransition(async () => {
                        await updateTransactionMetadata(editingTxId!, { note });
                        setTxDetails(prev => prev ? { ...prev, note } : null);
                      });
                    }}
                  />
                </Field>
              </FieldGroup>

              {/* Similar transactions */}
              {txDetails.similarHistory.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Historique similaire
                    </Label>
                  </div>
                  <div className="flex flex-col divide-y divide-border rounded-lg border overflow-hidden">
                    {txDetails.similarHistory.map((sim) => {
                      const simAmount = getTransactionAmountDisplay(sim.amount, sim.type, sim.currency);
                      return (
                        <button
                          key={sim.id}
                          className="flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => setEditingTxId(sim.id)}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-sm truncate">{sim.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {format(new Date(sim.dateOperation), "dd MMM yyyy")}
                              {sim.category && (
                                <span className="ml-2">{sim.category.name}</span>
                              )}
                            </span>
                          </div>
                          <span className={cn("text-sm font-medium tabular-nums shrink-0", simAmount.className)}>
                            {simAmount.prefix}{simAmount.value}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {txDetails.ownerUser && hasMultipleMembers && (
                <div className="text-xs text-muted-foreground">
                  Importé par {txDetails.ownerUser.name ?? txDetails.ownerUser.email}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
