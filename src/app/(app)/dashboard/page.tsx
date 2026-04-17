import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
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
import { format, type Locale } from "date-fns";
import { enUS, es, fr } from "date-fns/locale";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import {
  formatImportedRows,
  getDashboardMessages,
} from "@/lib/dashboard-messages";
import { normalizeAppLocale, type AppLocale } from "@/lib/locale";
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
import { computeRealBalances } from "@/lib/account-balance";
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

function getAllSearchParams(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildUserQuery(userIds: string[]): string {
  if (userIds.length === 0) return "";
  return userIds.map((id) => `user=${encodeURIComponent(id)}`).join("&");
}

function getDateFnsLocale(locale: AppLocale): Locale {
  if (locale === "en-US") return enUS;
  if (locale === "es-ES") return es;
  return fr;
}

function formatLongDate(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
  ownerUserIds: string[],
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date,
  dateLocale: Locale,
  otherCategoryLabel: string,
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
    return { start: s, end: e, label: format(s, "MMM", { locale: dateLocale }) };
  });

  const txBaseWhere = {
    bankAccount: { workspaceId },
    ...(ownerUserIds.length > 0
      ? ownerUserIds.length === 1
        ? { ownerUserId: ownerUserIds[0] }
        : { ownerUserId: { in: ownerUserIds } }
      : {}),
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
        ...(ownerUserIds.length > 0
          ? ownerUserIds.length === 1
            ? { createdByUserId: ownerUserIds[0] }
            : { createdByUserId: { in: ownerUserIds } }
          : {}),
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
      select: { id: true, name: true, referenceBalance: true, currency: true, type: true, bankInstitutionId: true },
    }),
  ]);

  const accountIds = bankAccounts.map((a) => a.id);
  const realBalances = await computeRealBalances(workspaceId, accountIds);

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
      name: cat?.name ?? otherCategoryLabel,
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
    realBalances,
    startDate,
    endDate,
  };
}

function formatPercent(current: number, previous: number, locale: AppLocale) {
  if (previous === 0) return null;
  const diff = ((current - previous) / previous) * 100;
  return {
    value: new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(diff) / 100),
    up: diff > 0,
  };
}

function formatPercentage(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const ctx = await getWorkspaceContext();
  const [members, rawSearchParams, userSettings] = await Promise.all([
    listWorkspaceMembers(ctx.workspaceId),
    searchParams,
    prisma.userSettings.findUnique({
      where: { userId: ctx.userId },
      select: { locale: true },
    }),
  ]);
  const locale = normalizeAppLocale(userSettings?.locale);
  const dateLocale = getDateFnsLocale(locale);
  const messages = getDashboardMessages(locale);

  const rawUsers = getAllSearchParams(rawSearchParams.user);
  const rawPeriod = getSearchParam(rawSearchParams.period);
  const userIds = new Set(members.map((m) => m.userId));
  const ownerUserIds = rawUsers.filter((u) => userIds.has(u));

  const { startDate, endDate, previousStartDate, previousEndDate } =
    getDateRangeFromPeriod(rawPeriod);

  const data = await getDashboardData(
    ctx.workspaceId,
    ownerUserIds,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    dateLocale,
    messages.sections.otherCategory
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
    data.previousPeriodExpenses,
    locale
  );
  const incomeTrend = formatPercent(
    data.thisMonthIncome,
    data.previousPeriodIncome,
    locale
  );

  const totalBalance = data.bankAccounts.reduce(
    (sum, a) => sum + (data.realBalances.get(a.id) ?? 0),
    0
  );

  const hasMultipleMembers = members.length > 1;
  const activePeriod: PeriodPreset =
    rawPeriod === "last_month" ||
    rawPeriod === "3_months" ||
    rawPeriod === "6_months" ||
    rawPeriod === "this_year"
      ? rawPeriod
      : "this_month";

  return (
    <AppPageShell>
      <AppPageHeader
        title={messages.title}
        description={formatLongDate(new Date(), locale)}
        actions={
          <div className="flex items-center gap-2">
            {hasMultipleMembers && (
              <DashboardUserFilter
                members={members.map((m) => ({
                  userId: m.userId,
                  name: m.user.name,
                  email: m.user.email,
                }))}
                activeUserIds={ownerUserIds}
                locale={locale}
              />
            )}
            <DashboardPeriodFilter activePeriod={activePeriod} locale={locale} />
          </div>
        }
      />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net balance */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {messages.kpis.netBalance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(netBalance, "EUR", locale)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.thisMonthIncome, "EUR", locale)} {messages.kpis.incomingOutgoing} ·{" "}
              {formatCurrency(data.thisMonthExpenses, "EUR", locale)} {messages.kpis.outgoing}
            </p>
          </CardContent>
        </Card>

        {/* Revenus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {messages.kpis.income}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(data.thisMonthIncome, "EUR", locale)}
            </p>
            {incomeTrend && (
              <p className="mt-1 text-xs text-muted-foreground">
                {incomeTrend.up ? "↑" : "↓"} {incomeTrend.value} {messages.kpis.trendVsPrevious}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dépenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {messages.kpis.expenses}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatCurrency(data.thisMonthExpenses, "EUR", locale)}
            </p>
            {expenseTrend && (
              <p className="mt-1 text-xs text-muted-foreground">
                {expenseTrend.up ? "↑" : "↓"} {expenseTrend.value} {messages.kpis.trendVsPrevious}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Taux d'épargne */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {messages.kpis.savingsRate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl tabular-nums">
              {formatPercentage(savingsRate, locale)}
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
              {messages.kpis.transfers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl tabular-nums">
              {formatCurrency(data.thisMonthTransfers, "EUR", locale)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{messages.kpis.selectedPeriod}</p>
          </CardContent>
        </Card>

        {/* Non catégorisé */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {messages.kpis.uncategorized}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl tabular-nums">
              {data.uncategorizedCount}
            </p>
            <Button asChild className="mt-1 h-auto p-0 text-xs" variant="link">
              <Link
                href={`/transactions?category=uncategorized${ownerUserIds.length > 0 ? `&${buildUserQuery(ownerUserIds)}` : ""}`}
              >
                {messages.kpis.categorizeAction} -&gt;
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Account balances */}
        {data.bankAccounts.length > 0 && (
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {messages.kpis.totalAccountsBalance}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-xl tabular-nums">
                  {formatCurrency(totalBalance, "EUR", locale)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.bankAccounts.slice(0, 3).map((acc) => (
                    <Badge key={acc.id} variant="secondary" className="text-xs">
                      {acc.name}
                      <span className="ml-1 text-muted-foreground">
                        {formatCurrency(data.realBalances.get(acc.id) ?? 0, acc.currency, locale)}
                      </span>
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
                <p className="text-sm">{messages.kpis.importTransactions}</p>
                <p className="text-xs text-muted-foreground">
                  {messages.kpis.csvFormatsSupported}
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={ownerUserIds.length > 0 ? `/imports?${buildUserQuery(ownerUserIds)}` : "/imports"}>
                  {messages.kpis.importAction}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <MonthlyTrendChart data={data.monthlySeries} locale={locale} />
        </div>
        <div>
          <CategoryDonutChart
            data={data.categoryData}
            total={data.totalCategoryExpenses}
            locale={locale}
          />
        </div>
      </div>

      {/* ── Daily spending + Top categories ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <DailySpendingChart data={data.dailyData} locale={locale} />
        </div>
        <div>
          <TopCategoriesList
            data={data.categoryData}
            total={data.totalCategoryExpenses}
            locale={locale}
          />
        </div>
      </div>

      {/* ── Transactions + Imports ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle>{messages.sections.recentTransactions}</CardTitle>
              <Button asChild className="h-auto p-0 text-sm" variant="link">
                <Link
                  href={`/transactions?sort=desc${ownerUserIds.length > 0 ? `&${buildUserQuery(ownerUserIds)}` : ""}`}
                >
                  {messages.sections.seeAllWithArrow}
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-4 p-0" />
                    <TableHead className="w-20 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{messages.sections.date}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{messages.sections.label}</TableHead>
                    <TableHead className="w-32 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{messages.sections.category}</TableHead>
                    <TableHead className="w-28 text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{messages.sections.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <span className="text-muted-foreground text-sm">
                          {messages.sections.noTransactions}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentTransactions.map((tx) => {
                      const amountDisplay = getTransactionAmountDisplay(
                        tx.amount.toNumber(),
                        tx.type,
                        tx.currency,
                        locale
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
                            {format(tx.dateOperation, "dd MMM", { locale: dateLocale })}
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
                                {messages.sections.uncategorizedCategory}
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
              <CardTitle>{messages.sections.recentImports}</CardTitle>
              <Button asChild className="h-auto p-0 text-sm" variant="link">
                <Link
                  href={
                    ownerUserIds.length > 0 ? `/imports?${buildUserQuery(ownerUserIds)}` : "/imports"
                  }
                >
                  {messages.sections.seeAll}
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.recentImports.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  {messages.sections.noRecentImports}
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
                          {formatDateTime(imp.createdAt, locale)} ·{" "}
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
                          ? formatImportedRows(imp.importedCount, locale)
                          : imp.status === "PROCESSING"
                          ? messages.sections.processing
                          : imp.status === "FAILED"
                          ? messages.sections.failed
                          : messages.sections.pending}
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
              <CardTitle>{messages.sections.quickActions}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link
                  href={
                    ownerUserIds.length > 0 ? `/imports?${buildUserQuery(ownerUserIds)}` : "/imports"
                  }
                >
                  {messages.sections.importStatement}
                </Link>
              </Button>
              {data.uncategorizedCount > 0 && (
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link
                    href={`/transactions?category=uncategorized${ownerUserIds.length > 0 ? `&${buildUserQuery(ownerUserIds)}` : ""}`}
                  >
                    {data.uncategorizedCount} {messages.kpis.uncategorized.toLowerCase()}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/accounts">{messages.sections.manageAccounts}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppPageShell>
  );
}
