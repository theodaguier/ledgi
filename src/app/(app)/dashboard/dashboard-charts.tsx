"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/transaction-amount";

export type MonthlyDataPoint = {
  month: string;
  income: number;
  expenses: number;
};

export type CategoryDataPoint = {
  name: string;
  amount: number;
  color: string;
  percent: number;
};

export type DailyDataPoint = {
  day: number;
  cumulative: number;
  daily: number;
};

// ─── Palette ─────────────────────────────────────────────────────────────────
// Curated set: readable on both light and dark, harmonious together
const COLOR_INCOME = "#10b981";   // emerald-500
const COLOR_EXPENSES = "#f43f5e"; // rose-500


// ─── Monthly Trend ──────────────────────────────────────────────────────────

const monthlyConfig: ChartConfig = {
  income: {
    label: "Revenus",
    color: COLOR_INCOME,
  },
  expenses: {
    label: "Dépenses",
    color: COLOR_EXPENSES,
  },
};

export function MonthlyTrendChart({ data }: { data: MonthlyDataPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Tendance sur 6 mois</CardTitle>
        <CardDescription>Revenus vs dépenses par mois</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={monthlyConfig}
          className="h-[220px] w-full"
          initialDimension={{ width: 500, height: 220 }}
        >
          <BarChart data={data} barCategoryGap="30%" barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
              width={38}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name,
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="income"
              fill="var(--color-income)"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              fill="var(--color-expenses)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Category Pie Chart ──────────────────────────────────────────────────────

export function CategoryDonutChart({
  data,
  total,
}: {
  data: CategoryDataPoint[];
  total: number;
}) {
  const pieConfig: ChartConfig = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.color }])
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Dépenses par catégorie</CardTitle>
        <CardDescription>Ce mois-ci · {formatCurrency(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Aucune dépense catégorisée ce mois
          </div>
        ) : (
          <>
            <ChartContainer
              config={pieConfig}
              className="h-[180px] w-full"
              initialDimension={{ width: 300, height: 180 }}
            >
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="amount"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name,
                      ]}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2 mt-2">
              {data.map((cat) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ background: cat.color }}
                  />
                  <span className="text-sm truncate flex-1">{cat.name}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Daily Spending Area Chart ───────────────────────────────────────────────

const dailyConfig: ChartConfig = {
  cumulative: {
    label: "Cumul dépenses",
    color: "var(--destructive)",
  },
  daily: {
    label: "Dépenses du jour",
    color: "var(--primary)",
  },
};

export function DailySpendingChart({ data }: { data: DailyDataPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses quotidiennes</CardTitle>
        <CardDescription>Évolution ce mois-ci</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={dailyConfig}
          className="h-[160px] w-full"
          initialDimension={{ width: 500, height: 160 }}
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-cumulative)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-cumulative)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
              width={38}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name,
                  ]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--color-cumulative)"
              strokeWidth={2}
              fill="url(#fillCumulative)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Top Categories List ─────────────────────────────────────────────────────

export function TopCategoriesList({
  data,
  total: _total,
}: {
  data: CategoryDataPoint[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top catégories</CardTitle>
        <CardDescription>Dépenses ce mois-ci</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucune dépense catégorisée
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((cat) => (
              <div key={cat.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2 rounded-full"
                      style={{ background: cat.color }}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${cat.percent}%`, background: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
