"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createAccount,
  updateAccount,
  deleteAccount,
} from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Landmark,
  MoreHorizontal,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { toast } from "sonner";
import { getAppMessages } from "@/lib/app-messages";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import type { AppLocale } from "@/lib/locale";
import { formatCurrency } from "@/lib/transaction-amount";
import { fetchBankLogos } from "@/lib/bank-logos-cache";
import { AccountForm } from "./account-form";
import { accountFormSchema } from "@/lib/validation/schemas";

interface Account {
  id: string;
  name: string;
  type: string | null;
  bankName: string | null;
  bankInstitutionId: string | null;
  bankBrandDomain: string | null;
  accountNumber: string | null;
  currentBalance: number;
  referenceBalance: number | null;
  referenceBalanceDate: Date | null;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  _count: { transactions: number };
}

interface AccountFormState {
  name: string;
  type: string;
  bankName: string;
  bankInstitutionId: string;
  bankBrandDomain: string;
  accountNumber: string;
  referenceBalance: string;
  referenceBalanceDate: string;
  currency: string;
}

export default function AccountsPageClient({
  accounts,
  locale,
  initialBrandLogos,
}: {
  accounts: Account[];
  locale: AppLocale;
  initialBrandLogos?: Record<string, string>;
}) {
  const messages = getAppMessages(locale).accounts;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormState>({
    name: "",
    type: "CHECKING",
    bankName: "",
    bankInstitutionId: "",
    bankBrandDomain: "",
    accountNumber: "",
    referenceBalance: "",
    referenceBalanceDate: "",
    currency: "EUR",
  });

  const [brandLogos, setBrandLogos] = useState<Record<string, string>>(initialBrandLogos ?? {});
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const institutionIds = accounts
      .map((acc) => acc.bankInstitutionId)
      .filter((id): id is string => Boolean(id));
    if (institutionIds.length === 0) return;
    fetchBankLogos(institutionIds)
      .then(setBrandLogos)
      .catch(() => {});
  }, [accounts]);

  const handleSubmit = (isEdit: boolean) => {
    const parsed = accountFormSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});

    startTransition(async () => {
      try {
        const payload = {
          name: form.name,
          type: form.type,
          bankName: form.bankName || null,
          bankInstitutionId: form.bankInstitutionId || null,
          bankBrandDomain: form.bankBrandDomain || null,
          accountNumber: form.accountNumber || null,
          referenceBalance: form.referenceBalance ? parseFloat(form.referenceBalance) : null,
          referenceBalanceDate: form.referenceBalanceDate ? new Date(form.referenceBalanceDate) : null,
          currency: form.currency,
        };

        if (isEdit && editingAccount) {
          await updateAccount(editingAccount.id, payload);
          toast.success(messages.updateSuccess);
        } else {
          await createAccount(payload);
          toast.success(messages.createSuccess);
        }
        resetForm();
        router.refresh();
      } catch {
        toast.error(messages.saveError);
      }
    });
  };

  const handleDelete = (acc: Account) => {
    setPendingDelete(acc);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    startTransition(async () => {
      try {
        await deleteAccount(pendingDelete.id);
        toast.success(messages.deleteSuccess);
        router.refresh();
      } catch {
        toast.error(messages.deleteError);
      } finally {
        setPendingDelete(null);
      }
    });
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingAccount(null);
    setForm({
      name: "",
      type: "CHECKING",
      bankName: "",
      bankInstitutionId: "",
      bankBrandDomain: "",
      accountNumber: "",
      referenceBalance: "",
      referenceBalanceDate: "",
      currency: "EUR",
    });
    setFormErrors({});
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      type: acc.type ?? "CHECKING",
      bankName: acc.bankName ?? "",
      bankInstitutionId: acc.bankInstitutionId ?? "",
      bankBrandDomain: acc.bankBrandDomain ?? "",
      accountNumber: acc.accountNumber ?? "",
      referenceBalance: acc.referenceBalance != null ? acc.referenceBalance.toString() : "",
      referenceBalanceDate: acc.referenceBalanceDate
        ? new Date(acc.referenceBalanceDate).toISOString().split("T")[0]
        : "",
      currency: acc.currency,
    });
  };

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const totalBalance = accounts.reduce((sum, acc) => {
    return sum + acc.currentBalance;
  }, 0);

  const totalCurrency = accounts[0]?.currency ?? "EUR";

  const accountTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    CHECKING: { icon: Wallet, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
    SAVINGS: { icon: PiggyBank, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    CREDIT_CARD: { icon: CreditCard, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40" },
    INVESTMENT: { icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
    OTHER: { icon: Landmark, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/60" },
  };

  return (
    <AppPageShell>
      <AppPageHeader
        title={messages.title}
        description={messages.description(accounts.length)}
        actions={
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="size-4" data-icon="inline-start" />
            {messages.newAccount}
          </Button>
        }
      />

      {/* Total Balance */}
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-between gap-4 py-5 px-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{messages.totalBalance}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(totalBalance, totalCurrency, locale)}
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">{accounts.length} {accounts.length > 1 ? "comptes" : "compte"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const typeKey = (acc.type ?? "OTHER") as keyof typeof accountTypeConfig;
          const { icon: TypeIcon, color, bg } = accountTypeConfig[typeKey] ?? accountTypeConfig.OTHER;
          const balance = acc.currentBalance;
          const isPositive = balance >= 0;
          const logoUrl = acc.bankInstitutionId ? (brandLogos[acc.bankInstitutionId] ?? null) : null;

          return (
            <Card key={acc.id} className="group relative overflow-hidden border-border/60">
              <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {logoUrl ? (
                        <div className="size-9 rounded-lg shrink-0 flex items-center justify-center bg-muted/30">
                          <img
                            src={logoUrl}
                            alt={acc.bankName ?? ""}
                            className="size-6 rounded object-contain"
                          />
                        </div>
                      ) : (
                        <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${bg}`}>
                          <TypeIcon className={`size-4 ${color}`} />
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <CardTitle className="text-sm font-semibold truncate leading-tight">{acc.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {acc.bankName ?? ((messages.accountTypes as Record<string, string>)[typeKey] ?? messages.accountTypes.OTHER)}
                        </p>
                      </div>
                    </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">{messages.actionsLabel}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(acc)}>
                        <Pencil className="size-4" />
                        {messages.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDelete(acc)}
                      >
                        <Trash2 className="size-4" />
                        {messages.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-5 flex flex-col gap-4">
                {/* Balance */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{messages.balance}</span>
                  <span className={`text-2xl font-semibold tracking-tight tabular-nums ${isPositive ? "" : "text-destructive"}`}>
                    {formatCurrency(balance, acc.currency, locale)}
                  </span>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/60" />

                {/* Footer stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Receipt className="size-3.5" />
                    <span>{acc._count.transactions} {messages.transactions.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal border-border/60">
                      {acc.currency} {new Intl.NumberFormat(locale, { style: "currency", currency: acc.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === "currency")?.value}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Sheet */}
      <Sheet open={isCreating} onOpenChange={(open) => !open && resetForm()}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{messages.newSheetTitle}</SheetTitle>
            <SheetDescription>
              {messages.newSheetDescription}
            </SheetDescription>
          </SheetHeader>
          <AccountForm
            form={form}
            setForm={setForm}
            locale={locale}
            isPending={isPending}
            onSubmit={() => handleSubmit(false)}
            onCancel={resetForm}
            errors={formErrors}
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
            <SheetTitle>{messages.editSheetTitle}</SheetTitle>
            <SheetDescription>{editingAccount?.name}</SheetDescription>
          </SheetHeader>
          <AccountForm
            form={form}
            setForm={setForm}
            locale={locale}
            isPending={isPending}
            onSubmit={() => handleSubmit(true)}
            onCancel={() => setEditingAccount(null)}
            isEdit
            errors={formErrors}
          />
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={messages.deleteDialogTitle}
        description={
          pendingDelete && pendingDelete._count.transactions > 0
            ? messages.deleteDialogDescription(pendingDelete._count.transactions)
            : messages.deleteDialogDescription(0)
        }
        confirmLabel={messages.deleteDialogConfirm}
        destructive
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </AppPageShell>
  );
}
