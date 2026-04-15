"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAccount, updateAccount, deleteAccount } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Account {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number | string | null;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  _count: { transactions: number };
}

interface AccountFormState {
  name: string;
  bankName: string;
  accountNumber: string;
  balance: string;
  currency: string;
}

export default function AccountsPageClient({
  accounts,
}: {
  accounts: Account[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormState>({
    name: "",
    bankName: "",
    accountNumber: "",
    balance: "",
    currency: "EUR",
  });

  const handleSubmit = (isEdit: boolean) => {
    if (!form.name.trim()) return;

    startTransition(async () => {
      try {
        if (isEdit && editingAccount) {
          await updateAccount(editingAccount.id, {
            name: form.name,
            bankName: form.bankName || null,
            accountNumber: form.accountNumber || null,
            balance: form.balance ? parseFloat(form.balance) : null,
            currency: form.currency,
          });
          toast.success("Compte mis à jour");
        } else {
          await createAccount({
            name: form.name,
            bankName: form.bankName || null,
            accountNumber: form.accountNumber || null,
            balance: form.balance ? parseFloat(form.balance) : null,
            currency: form.currency,
          });
          toast.success("Compte créé");
        }
        resetForm();
        router.refresh();
      } catch {
        toast.error("Erreur lors de l'enregistrement");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteAccount(id);
        toast.success("Compte supprimé");
        router.refresh();
      } catch {
        toast.error("Erreur lors de la suppression");
      }
    });
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingAccount(null);
    setForm({
      name: "",
      bankName: "",
      accountNumber: "",
      balance: "",
      currency: "EUR",
    });
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      bankName: acc.bankName ?? "",
      accountNumber: acc.accountNumber ?? "",
      balance: acc.balance?.toString() ?? "",
      currency: acc.currency,
    });
  };

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  function formatCurrency(amount: number, currency = "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(amount);
  }

  const totalBalance = accounts.reduce((sum, acc) => {
    const bal =
      typeof acc.balance === "string"
        ? parseFloat(acc.balance)
        : acc.balance ?? 0;
    return sum + bal;
  }, 0);

  const totalCurrency = accounts[0]?.currency ?? "EUR";

  const AccountForm = ({
    account,
    onSubmit,
    onCancel,
  }: {
    account?: Account | null;
    onSubmit: () => void;
    onCancel: () => void;
  }) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Nom du compte</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Compte Principal"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Banque</Label>
        <Input
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          placeholder="Nom de la banque"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Numéro de compte</Label>
        <Input
          value={form.accountNumber}
          onChange={(e) =>
            setForm({ ...form, accountNumber: e.target.value })}
          placeholder="Optionnel"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Solde initial</Label>
        <Input
          type="number"
          step="0.01"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          placeholder="0.00"
        />
      </div>
      <SheetFooter className="mt-2 gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
        <Button onClick={onSubmit} disabled={isPending || !form.name.trim()}>
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Enregistrement...
            </>
          ) : account ? (
            "Enregistrer"
          ) : (
            "Créer le compte"
          )}
        </Button>
      </SheetFooter>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Comptes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {accounts.length} compte{accounts.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="size-4" data-icon="inline-start" />
          Nouveau compte
        </Button>
      </div>

      {/* Total Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 shrink-0">
            <Landmark className="size-5 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-muted-foreground">Solde total</p>
            <p className="text-2xl font-semibold tracking-tight">
              {formatCurrency(totalBalance, totalCurrency)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <Card key={acc.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <CardTitle className="text-base">{acc.name}</CardTitle>
                  {acc.bankName && (
                    <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {acc.currency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Solde</span>
                <span className="text-base font-semibold">
                  {acc.balance != null
                    ? formatCurrency(
                        parseFloat(acc.balance.toString()),
                        acc.currency
                      )
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  Transactions
                </span>
                <span className="text-sm">{acc._count.transactions}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Créé le {format(new Date(acc.createdAt), "dd/MM/yyyy")}
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(acc)}
                >
                  <Pencil className="size-3" data-icon="inline-start" />
                  Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(acc.id)}
                  disabled={acc._count.transactions > 0}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Sheet */}
      <Sheet open={isCreating} onOpenChange={(open) => !open && resetForm()}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nouveau compte</SheetTitle>
            <SheetDescription>
              Ajoutez un nouveau compte bancaire pour suivre vos transactions.
            </SheetDescription>
          </SheetHeader>
          <AccountForm
            onSubmit={() => handleSubmit(false)}
            onCancel={resetForm}
          />
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier le compte</SheetTitle>
            <SheetDescription>
              {editingAccount?.name}
            </SheetDescription>
          </SheetHeader>
          <AccountForm
            account={editingAccount}
            onSubmit={() => handleSubmit(true)}
            onCancel={() => setEditingAccount(null)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
