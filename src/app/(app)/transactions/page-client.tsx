"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionCategory } from "@/actions/transactions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Search, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Transaction {
  id: string;
  dateOperation: Date;
  label: string;
  labelNormalized: string | null;
  merchant: string | null;
  amount: number;
  currency: string;
  type: string;
  confidence: number;
  category: { id: string; name: string; slug: string } | null;
  bankAccount: { name: string };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function TransactionsTable({
  transactions,
  categories,
  searchParams,
}: {
  transactions: Transaction[];
  categories: Category[];
  searchParams: { q?: string; category?: string; uncategorized?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.q ?? "");
  const [filterCategory, setFilterCategory] = useState(
    searchParams.category ?? "all"
  );
  const [filterUncategorized, setFilterUncategorized] = useState(
    searchParams.uncategorized === "true"
  );

  const filtered = transactions.filter((tx) => {
    const matchesSearch = searchQuery
      ? tx.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.labelNormalized?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.merchant?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesCategory =
      filterCategory === "all"
        ? true
        : filterCategory === "uncategorized"
        ? !tx.category
        : tx.category?.id === filterCategory;

    const matchesUncategorized = filterUncategorized ? !tx.category : true;

    return matchesSearch && matchesCategory && matchesUncategorized;
  });

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

  function formatCurrency(amount: number, currency = "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(amount);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par libellé, marchand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={filterCategory}
            onValueChange={(val) => setFilterCategory(val ?? "all")}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="size-3 mr-1.5 text-muted-foreground" data-icon="inline-start" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              <SelectItem value="uncategorized">Non catégorisé</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              {filtered.length} transaction{filtered.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="w-[140px]">Catégorie</TableHead>
              <TableHead className="w-[110px] hidden sm:table-cell">Compte</TableHead>
              <TableHead className="w-[110px] text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <span className="text-muted-foreground">
                    Aucune transaction
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer"
                  onClick={() => setEditingTx(tx)}
                >
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tx.dateOperation), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate max-w-[260px]">{tx.label}</span>
                      {tx.merchant && (
                        <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                          {tx.merchant}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {tx.category ? (
                        <Badge variant="secondary">{tx.category.name}</Badge>
                      ) : (
                        <Badge variant="outline">Non catégorisé</Badge>
                      )}
                      {tx.confidence > 0 && tx.confidence < 0.7 && (
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(tx.confidence * 100)}%)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {tx.bankAccount.name}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      tx.type === "DEBIT"
                        ? ""
                        : tx.type === "CREDIT"
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {tx.type === "DEBIT" ? "-" : "+"}
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                </TableRow>
              ))
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
            <div className="flex flex-col gap-5 mt-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{editingTx.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(editingTx.dateOperation), "dd MMMM yyyy")} ·{" "}
                  <span
                    className={
                      editingTx.type === "DEBIT"
                        ? ""
                        : editingTx.type === "CREDIT"
                        ? "text-emerald-600"
                        : ""
                    }
                  >
                    {editingTx.type === "DEBIT" ? "-" : "+"}
                    {formatCurrency(editingTx.amount, editingTx.currency)}
                  </span>
                </p>
                {editingTx.merchant && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editingTx.merchant}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Catégorie</Label>
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
                  <SelectTrigger>
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
              </div>

              {isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Mise à jour en cours...
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
