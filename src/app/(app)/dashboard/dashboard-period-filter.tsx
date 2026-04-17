"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getDashboardMessages } from "@/lib/dashboard-messages";
import type { AppLocale } from "@/lib/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarRange, ChevronDown } from "lucide-react";

export type PeriodPreset = "this_month" | "last_month" | "3_months" | "6_months" | "this_year";

const PERIOD_OPTIONS: PeriodPreset[] = [
  "this_month",
  "last_month",
  "3_months",
  "6_months",
  "this_year",
];

interface DashboardPeriodFilterProps {
  activePeriod?: PeriodPreset;
  locale: AppLocale;
}

export function DashboardPeriodFilter({
  activePeriod = "this_month",
  locale,
}: DashboardPeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const messages = getDashboardMessages(locale);

  const activeLabel = messages.filters.periods[activePeriod];

  const handlePeriodChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "this_month") {
        params.delete("period");
      } else {
        params.set("period", value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={activePeriod !== "this_month" ? "secondary" : "outline"}>
          <CalendarRange data-icon="inline-start" />
          <span>{activeLabel}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={activePeriod}
          onValueChange={handlePeriodChange}
        >
          {PERIOD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {messages.filters.periods[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
