import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowLeftRight,
  AlertCircle,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

async function getDashboardData(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    thisMonthExpenses,
    lastMonthExpenses,
    thisMonthIncome,
    lastMonthIncome,
    thisMonthTransfers,
    recentTransactions,
    uncategorizedCount,
    recentImports,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        bankAccount: { userId },
        dateOperation: { gte: startOfMonth },
        type: "DEBIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        bankAccount: { userId },
        dateOperation: { gte: startOfLastMonth, lte: endOfLastMonth },
        type: "DEBIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        bankAccount: { userId },
        dateOperation: { gte: startOfMonth },
        type: "CREDIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        bankAccount: { userId },
        dateOperation: { gte: startOfLastMonth, lte: endOfLastMonth },
        type: "CREDIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        bankAccount: { userId },
        dateOperation: { gte: startOfMonth },
        type: "TRANSFER",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { bankAccount: { userId } },
      orderBy: { dateOperation: "desc" },
      take: 8,
      include: { category: true },
    }),
    prisma.transaction.count({
      where: { bankAccount: { userId }, categoryId: null },
    }),
    prisma.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { bankAccount: true },
    }),
  ]);

  return {
    thisMonthExpenses: thisMonthExpenses._sum.amount?.toNumber() ?? 0,
    lastMonthExpenses: lastMonthExpenses._sum.amount?.toNumber() ?? 0,
    thisMonthIncome: thisMonthIncome._sum.amount?.toNumber() ?? 0,
    lastMonthIncome: lastMonthIncome._sum.amount?.toNumber() ?? 0,
    thisMonthTransfers: thisMonthTransfers._sum.amount?.toNumber() ?? 0,
    recentTransactions,
    uncategorizedCount,
    recentImports,
  };
}

function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatPercent(current: number, previous: number) {
  if (previous === 0) return "—";
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const data = await getDashboardData(session.user.id);
  const expenseDiff = data.thisMonthExpenses - data.lastMonthExpenses;
  const expensePct = formatPercent(data.thisMonthExpenses, data.lastMonthExpenses);
  const incomePct = formatPercent(data.thisMonthIncome, data.lastMonthIncome);
  const netBalance = data.thisMonthIncome - data.thisMonthExpenses;

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Balance — hero KPI */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              Solde net ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-foreground">
              {formatCurrency(netBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenus {formatCurrency(data.thisMonthIncome)} − Dépenses{" "}
              {formatCurrency(data.thisMonthExpenses)}
            </p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="size-3.5" />
              Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {formatCurrency(data.thisMonthExpenses)}
            </div>
            <p
              className={`text-xs mt-1 ${
                expenseDiff <= 0 ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {expensePct} vs mois dernier
            </p>
          </CardContent>
        </Card>

        {/* Revenus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {formatCurrency(data.thisMonthIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {incomePct} vs mois dernier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-1.5">
              <ArrowLeftRight className="size-3.5" />
              Virements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tracking-tight">
              {formatCurrency(data.thisMonthTransfers)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              Non catégorisé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tracking-tight">
              {data.uncategorizedCount}
            </div>
            <Link
              href="/transactions?uncategorized=true"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Voir les transactions
            </Link>
          </CardContent>
        </Card>

        {/* Import CTA — spans 2 cols */}
        <Card className="col-span-2">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Importer des transactions</p>
              <p className="text-xs text-muted-foreground">
                Formats CSV supportés
              </p>
            </div>
            <Link
              href="/imports"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/95"
            >
              <Upload className="size-4" data-icon="inline-start" />
              Importer
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Bottom section: Transactions + Imports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Transactions récentes</CardTitle>
              <Link
                href="/transactions"
                className="text-sm text-primary hover:underline"
              >
                Tout voir
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <span className="text-muted-foreground">
                          Aucune transaction
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground">
                          {format(tx.dateOperation, "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {tx.label}
                        </TableCell>
                        <TableCell>
                          {tx.category ? (
                            <Badge variant="secondary">{tx.category.name}</Badge>
                          ) : (
                            <Badge variant="outline">Non catégorisé</Badge>
                          )}
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
                          {formatCurrency(tx.amount.toNumber())}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent Imports */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Imports récents</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentImports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun import récent
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border/60">
                  {data.recentImports.map((imp) => (
                    <div
                      key={imp.id}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm truncate">{imp.fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(imp.createdAt, "dd/MM/yyyy HH:mm")} ·{" "}
                          {imp.bankAccount.name}
                        </span>
                      </div>
                      <Badge
                        variant={
                          imp.status === "COMPLETED"
                            ? "secondary"
                            : imp.status === "FAILED"
                            ? "destructive"
                            : "outline"
                        }
                        className="shrink-0"
                      >
                        {imp.status === "COMPLETED"
                          ? `${imp.importedCount}`
                          : imp.status === "PROCESSING"
                          ? "En cours"
                          : imp.status === "FAILED"
                          ? "Erreur"
                          : "En attente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
