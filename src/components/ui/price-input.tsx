"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group"

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
}

interface PriceInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  currency?: string
  value?: string | number
  onChange?: (value: string) => void
  "aria-invalid"?: boolean
}

function PriceInput({
  currency = "EUR",
  value,
  onChange,
  className,
  ...props
}: PriceInputProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Allow empty, digits, one leading minus, one decimal point
    if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) {
      onChange?.(raw)
    }
  }

  return (
    <InputGroup className={cn(className)}>
      <InputGroupAddon align="inline-start">
        <InputGroupText>{symbol}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        inputMode="decimal"
        value={value ?? ""}
        onChange={handleChange}
        placeholder="0.00"
        {...props}
      />
    </InputGroup>
  )
}

export { PriceInput }
export type { PriceInputProps }
