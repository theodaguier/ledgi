export type TransactionAmountType = "CREDIT" | "DEBIT" | "TRANSFER" | "FEE" | string

export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount)
}

export function getTransactionAmountDisplay(
  amount: number,
  type: TransactionAmountType,
  currency = "EUR"
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
    value: formatCurrency(amount, currency),
  }
}
