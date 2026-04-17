export type TransactionAmountType = "CREDIT" | "DEBIT" | "TRANSFER" | "FEE" | string

export function formatCurrency(amount: number, currency = "EUR", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount)
}

export function getTransactionAmountDisplay(
  amount: number,
  type: TransactionAmountType,
  currency = "EUR",
  locale = "fr-FR"
) {
  const isPositive = type === "CREDIT"
  const isNegative = type === "DEBIT" || type === "FEE"

  return {
    className: isPositive
      ? "text-green-600 dark:text-green-400"
      : isNegative
      ? "text-destructive"
        : "text-muted-foreground",
    prefix: isNegative ? "-" : isPositive ? "+" : "",
    value: formatCurrency(amount, currency, locale),
  }
}
