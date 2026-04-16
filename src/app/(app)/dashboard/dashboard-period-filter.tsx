"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarRange, ChevronDown } from "lucide-react";

export type PeriodPreset = "this_month" | "last_month" | "3_months" | "6_months" | "this_year";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month", label: "Ce mois" },
  { value: "last_month", label: "Mois dernier" },
  { value: "3_months", label: "3 derniers mois" },
  { value: "6_months", label: "6 derniers mois" },
  { value: "this_year", label: "Année en cours" },
];

interface DashboardPeriodFilterProps {
  activePeriod?: PeriodPreset;
}

export function DashboardPeriodFilter({
  activePeriod = "this_month",
}: DashboardPeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeLabel =
    PERIOD_OPTIONS.find((o) => o.value === activePeriod)?.label ?? "Ce mois";

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
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
