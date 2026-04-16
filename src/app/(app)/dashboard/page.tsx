import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
import { siteConfig } from "@/config";
import { Button } from "@/components/ui/button";
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
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import {
  formatCurrency,
  getTransactionAmountDisplay,
} from "@/lib/transaction-amount";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};
import {
  ArrowLeftRight,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CategoryIcon } from "@/lib/category-icon";
import {
  MonthlyTrendChart,
  CategoryDonutChart,
  DailySpendingChart,
  TopCategoriesList,
  type MonthlyDataPoint,
  type CategoryDataPoint,
  type DailyDataPoint,
} from "./dashboard-charts";
import { getWorkspaceContext, listWorkspaceMembers } from "@/lib/workspace";
import { DashboardUserFilter } from "./dashboard-user-filter";
import { DashboardPeriodFilter, type PeriodPreset } from "./dashboard-period-filter";

type DashboardSearchParams = Promise<{
  user?: string | string[];
  period?: string | string[];
}>;

function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function getDateRangeFromPeriod(period: string | undefined): {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
} {
  const now = new Date();
  const currentYear = now.getFullYear();

  switch (period) {
    case "last_month": {
      const start = new Date(currentYear, now.getMonth() - 1, 1);
      const end = new Date(currentYear, now.getMonth(), 0);
      const pStart = new Date(currentYear, now.getMonth() - 2, 1);
      const pEnd = new Date(currentYear, now.getMonth() - 1, 0);
      return { startDate: start, endDate: end, previousStartDate: pStart, previousEndDate: pEnd };
    }
    case "3_months": {
      const start = new Date(currentYear, now.getMonth() - 2, 1);
      const end = now;
      const pStart = new Date(currentYear, now.getMonth() - 5, 1);
      const pEnd = new Date(currentYear, now.getMonth() - 2, 0);
      return { startDate: start, endDate: end, previousStartDate: pStart, previousEndDate: pEnd };
    }
    case "6_months": {
      const start = new Date(currentYear, now.getMonth() - 5, 1);
      const end = now;
      const pStart = new Date(currentYear, now.getMonth() - 11, 1);
      const pEnd = new Date(currentYear, now.getMonth() - 5, 0);
      return { startDate: start, endDate: end, previousStartDate: pStart, previousEndDate: pEnd };
    }
    case "this_year": {
      const start = new Date(currentYear, 0, 1);
      const end = now;
      const pStart = new Date(currentYear - 1, 0, 1);
      const pEnd = new Date(currentYear - 1, now.getMonth(), now.getDate());
      return { startDate: start, endDate: end, previousStartDate: pStart, previousEndDate: pEnd };
    }
    default: {
      const start = new Date(currentYear, now.getMonth(), 1);
      const end = now;
      const pStart = new Date(currentYear, now.getMonth() - 1, 1);
      const pEnd = new Date(currentYear, now.getMonth(), 0);
      return { startDate: start, endDate: end, previousStartDate: pStart, previousEndDate: pEnd };
    }
  }
}

async function getDashboardData(
  workspaceId: string,
  ownerUserId: string | undefined,
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date,
) {
  const monthCount =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    ) || 1;

  const monthRanges = Array.from({ length: Math.min(monthCount, 12) }, (_, i) => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: s, end: e, label: format(s, "MMM", { locale: fr }) };
  });

  const txBaseWhere = {
    bankAccount: { workspaceId },
    ...(ownerUserId ? { ownerUserId } : {}),
  };

  const [
    thisMonthExpenses,
    previousPeriodExpenses,
    thisMonthIncome,
    previousPeriodIncome,
    thisMonthTransfers,
    recentTransactions,
    uncategorizedCount,
    recentImports,
    monthlySeries,
    categoryGroups,
    dailyTransactions,
    bankAccounts,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...txBaseWhere, dateOperation: { gte: startDate, lte: endDate }, type: "DEBIT" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        ...txBaseWhere,
        dateOperation: { gte: previousStartDate, lte: previousEndDate },
        type: "DEBIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...txBaseWhere, dateOperation: { gte: startDate, lte: endDate }, type: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        ...txBaseWhere,
        dateOperation: { gte: previousStartDate, lte: previousEndDate },
        type: "CREDIT",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...txBaseWhere, dateOperation: { gte: startDate, lte: endDate }, type: "TRANSFER" },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: txBaseWhere,
      orderBy: { dateOperation: "desc" },
      take: 8,
      include: { category: true },
    }),
    prisma.transaction.count({
      where: { ...txBaseWhere, categoryId: null },
    }),
    prisma.importBatch.findMany({
      where: {
        workspaceId,
        ...(ownerUserId ? { createdByUserId: ownerUserId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { bankAccount: true },
    }),
    Promise.all(
      monthRanges.map(({ start, end, label }) =>
        Promise.all([
          prisma.transaction.aggregate({
            where: {
              ...txBaseWhere,
              dateOperation: { gte: start, lte: end },
              type: "CREDIT",
            },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: {
              ...txBaseWhere,
              dateOperation: { gte: start, lte: end },
              type: "DEBIT",
            },
            _sum: { amount: true },
          }),
        ]).then(([inc, exp]) => ({
          month: label,
          income: inc._sum.amount?.toNumber() ?? 0,
          expenses: exp._sum.amount?.toNumber() ?? 0,
        }))
      )
    ),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        ...txBaseWhere,
        dateOperation: { gte: startDate, lte: endDate },
        type: "DEBIT",
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 6,
    }),
    prisma.transaction.findMany({
      where: {
        ...txBaseWhere,
        dateOperation: { gte: startDate, lte: endDate },
        type: "DEBIT",
      },
      select: { dateOperation: true, amount: true },
      orderBy: { dateOperation: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, balance: true, currency: true, type: true },
    }),
  ]);

  const categoryIds = categoryGroups
    .map((g) => g.categoryId)
    .filter(Boolean) as string[];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const totalCategoryExpenses = categoryGroups.reduce(
    (sum, g) => sum + (g._sum.amount?.toNumber() ?? 0),
    0
  );

  const categoryData: CategoryDataPoint[] = categoryGroups.map((g) => {
    const amount = g._sum.amount?.toNumber() ?? 0;
    const cat = g.categoryId ? categoryMap[g.categoryId] : null;
    return {
      name: cat?.name ?? "Autre",
      amount,
      color: cat?.color ?? "",
      percent:
        totalCategoryExpenses > 0 ? (amount / totalCategoryExpenses) * 100 : 0,
    };
  });

  const daysInRange = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const dailyMap = new Map<number, number>();
  for (const tx of dailyTransactions) {
    const day = tx.dateOperation.getDate();
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amount.toNumber());
  }
  let cumulative = 0;
  const dailyData: DailyDataPoint[] = Array.from(
    { length: daysInRange },
    (_, i) => {
      const day = i + 1;
      const daily = dailyMap.get(day) ?? 0;
      cumulative += daily;
      return { day, daily, cumulative };
    }
  );

  return {
    thisMonthExpenses: thisMonthExpenses._sum.amount?.toNumber() ?? 0,
    previousPeriodExpenses: previousPeriodExpenses._sum.amount?.toNumber() ?? 0,
    thisMonthIncome: thisMonthIncome._sum.amount?.toNumber() ?? 0,
    previousPeriodIncome: previousPeriodIncome._sum.amount?.toNumber() ?? 0,
    thisMonthTransfers: thisMonthTransfers._sum.amount?.toNumber() ?? 0,
    recentTransactions,
    uncategorizedCount,
    recentImports,
    monthlySeries: monthlySeries as MonthlyDataPoint[],
    categoryData,
    totalCategoryExpenses,
    dailyData,
    bankAccounts,
    startDate,
    endDate,
  };
}

function formatPercent(current: number, previous: number) {
  if (previous === 0) return null;
  const diff = ((current - previous) / previous) * 100;
  return { value: `${Math.abs(diff).toFixed(1)}%`, up: diff > 0 };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const ctx = await getWorkspaceContext();
  const [members, rawSearchParams] = await Promise.all([
    listWorkspaceMembers(ctx.workspaceId),
    searchParams,
  ]);

  const rawUser = getSearchParam(rawSearchParams.user);
  const rawPeriod = getSearchParam(rawSearchParams.period);
  const userIds = new Set(members.map((m) => m.userId));
  const ownerUserId = rawUser && userIds.has(rawUser) ? rawUser : undefined;

  const { startDate, endDate, previousStartDate, previousEndDate } =
    getDateRangeFromPeriod(rawPeriod);

  const data = await getDashboardData(
    ctx.workspaceId,
    ownerUserId,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate
  );
  const netBalance = data.thisMonthIncome - data.thisMonthExpenses;
  const savingsRate =
    data.thisMonthIncome > 0
      ? ((data.thisMonthIncome - data.thisMonthExpenses) /
          data.thisMonthIncome) *
        100
      : 0;

  const expenseTrend = formatPercent(
    data.thisMonthExpenses,
    data.previousPeriodExpenses
  );
  const incomeTrend = formatPercent(
    data.thisMonthIncome,
    data.previousPeriodIncome
  );

  const totalBalance = data.bankAccounts.reduce(
    (sum, a) => sum + (a.balance?.toNumber() ?? 0),
    0
  );

  const hasMultipleMembers = members.length > 1;
  const activePeriod = (rawPeriod as PeriodPreset) || "this_month";

  return (
    <AppPageShell>
      <AppPageHeader
        title="Dashboard"
        description={format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        actions={
          <div className="flex items-center gap-2">
            {hasMultipleMembers && (
              <DashboardUserFilter
                members={members.map((m) => ({
                  userId: m.userId,
                  name: m.user.name,
                  email: m.user.email,
                }))}
                activeUserId={ownerUserId}
              />
            )}
            <DashboardPeriodFilter activePeriod={activePeriod} />
          </div>
        }
      />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net balance */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde net ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(netBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.thisMonthIncome)} entrants ·{" "}
              {formatCurrency(data.thisMonthExpenses)} sortants
            </p>
          </CardContent>
        </Card>

        {/* Revenus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(data.thisMonthIncome)}
            </p>
            {incomeTrend && (
              <p className="mt-1 text-xs text-muted-foreground">
                {incomeTrend.up ? "↑" : "↓"} {incomeTrend.value} vs mois dernier
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dépenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(data.thisMonthExpenses)}
            </p>
            {expenseTrend && (
              <p className="mt-1 text-xs text-muted-foreground">
                {expenseTrend.up ? "↑" : "↓"} {expenseTrend.value} vs mois dernier
              </p>
            )}
          </CardContent>
        </Card>

        {/* Taux d'épargne */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux d&apos;épargne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {savingsRate.toFixed(1)}%
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Secondary KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Virements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Virements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl tabular-nums">
              {formatCurrency(data.thisMonthTransfers)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
          </CardContent>
        </Card>

        {/* Non catégorisé */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              À catégoriser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl tabular-nums">
              {data.uncategorizedCount}
            </p>
            <Button asChild className="mt-1 h-auto p-0 text-xs" variant="link">
              <Link
                href={
                  ownerUserId
                    ? `/transactions?category=uncategorized&user=${ownerUserId}`
                    : "/transactions?category=uncategorized"
                }
              >
                Catégoriser →
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Account balances */}
        {data.bankAccounts.length > 0 && (
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Solde total des comptes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-xl tabular-nums">
                  {formatCurrency(totalBalance)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.bankAccounts.slice(0, 3).map((acc) => (
                    <Badge key={acc.id} variant="secondary" className="text-xs">
                      {acc.name}
                      {acc.balance != null && (
                        <span className="ml-1 text-muted-foreground">
                          {formatCurrency(acc.balance.toNumber(), acc.currency)}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import CTA when no accounts */}
        {data.bankAccounts.length === 0 && (
          <Card className="col-span-2">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm">Importer des transactions</p>
                <p className="text-xs text-muted-foreground">
                  Formats CSV supportés
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={ownerUserId ? `/imports?user=${ownerUserId}` : "/imports"}>
                  Importer
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <MonthlyTrendChart data={data.monthlySeries} />
        </div>
        <div>
          <CategoryDonutChart
            data={data.categoryData}
            total={data.totalCategoryExpenses}
          />
        </div>
      </div>

      {/* ── Daily spending + Top categories ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <DailySpendingChart data={data.dailyData} />
        </div>
        <div>
          <TopCategoriesList
            data={data.categoryData}
            total={data.totalCategoryExpenses}
          />
        </div>
      </div>

      {/* ── Transactions + Imports ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle>Transactions récentes</CardTitle>
              <Button asChild className="h-auto p-0 text-sm" variant="link">
                <Link
                  href={
                    ownerUserId
                      ? `/transactions?sort=desc&user=${ownerUserId}`
                      : "/transactions?sort=desc"
                  }
                >
                  Tout voir →
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-4 p-0" />
                    <TableHead className="w-20 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Libellé</TableHead>
                    <TableHead className="w-32 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Catégorie</TableHead>
                    <TableHead className="w-28 text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <span className="text-muted-foreground text-sm">
                          Aucune transaction
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentTransactions.map((tx) => {
                      const amountDisplay = getTransactionAmountDisplay(
                        tx.amount.toNumber(),
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
                        <TableRow key={tx.id} className="group">
                          {/* Type indicator */}
                          <TableCell className="p-0 w-4">
                            <div className={cn("w-0.5 min-h-[2.75rem] mx-auto", typeColor)} />
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums text-xs py-2.5">
                            {format(tx.dateOperation, "dd MMM", { locale: fr })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn(
                                "shrink-0 size-6 flex items-center justify-center",
                                tx.type === "CREDIT"
                                  ? "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400"
                                  : tx.type === "DEBIT"
                                  ? "bg-destructive/8 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                <TypeIcon className="size-3" />
                              </div>
                              <span className="truncate text-sm font-medium leading-tight">
                                {tx.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
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
                                <span className="font-medium">{tx.category.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="size-5 shrink-0 flex items-center justify-center bg-muted">
                                  <Layers className="size-3" />
                                </span>
                                Non catégorisé
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums text-sm py-2.5",
                              amountDisplay.className
                            )}
                          >
                            {amountDisplay.prefix}
                            {amountDisplay.value}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          {/* Recent imports */}
          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Imports récents</CardTitle>
              <Button asChild className="h-auto p-0 text-sm" variant="link">
                <Link
                  href={
                    ownerUserId ? `/imports?user=${ownerUserId}` : "/imports"
                  }
                >
                  Voir tout
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.recentImports.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Aucun import récent
                </p>
              ) : (
                <div className="flex flex-col divide-y">
                  {data.recentImports.map((imp) => (
                    <div
                      key={imp.id}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="truncate text-sm">{imp.fileName}</span>
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
                        className="shrink-0 text-xs"
                      >
                        {imp.status === "COMPLETED"
                          ? `${imp.importedCount} lignes`
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

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link
                  href={
                    ownerUserId ? `/imports?user=${ownerUserId}` : "/imports"
                  }
                >
                  Importer un relevé
                </Link>
              </Button>
              {data.uncategorizedCount > 0 && (
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link
                    href={
                      ownerUserId
                        ? `/transactions?category=uncategorized&user=${ownerUserId}`
                        : "/transactions?category=uncategorized"
                    }
                  >
                    {data.uncategorizedCount} à catégoriser
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/accounts">Gérer les comptes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppPageShell>
  );
}
