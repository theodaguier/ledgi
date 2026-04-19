import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
import AccountsPageClient from "./page-client";
import { getWorkspaceContext } from "@/lib/workspace";
import { computeRealBalances } from "@/lib/account-balance";
import { normalizeAppLocale } from "@/lib/locale";
import { siteConfig } from "@/config";
import { buildLogoUrlFromBrandDomain } from "@/lib/bank-logo-resolver";

export const metadata: Metadata = {
  title: "Comptes",
};

export default async function AccountsPage() {
  const ctx = await getWorkspaceContext();

  const [accountsRaw, userSettings] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { transactions: true } },
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId: ctx.userId },
      select: { locale: true },
    }),
  ]);

  const accountIds = accountsRaw.map((a) => a.id);
  const realBalances = await computeRealBalances(ctx.workspaceId, accountIds);
  const locale = normalizeAppLocale(userSettings?.locale ?? siteConfig.locale);

  const accounts = accountsRaw.map((acc) => ({
    ...acc,
    currentBalance: realBalances.get(acc.id) ?? 0,
    referenceBalance: acc.referenceBalance ? Number(acc.referenceBalance) : null,
    referenceBalanceDate: acc.referenceBalanceDate ?? null,
  }));

  const initialBrandLogos: Record<string, string> = {};
  for (const acc of accounts) {
    if (acc.bankInstitutionId && acc.bankBrandDomain) {
      const url = buildLogoUrlFromBrandDomain(acc.bankBrandDomain);
      if (url) initialBrandLogos[acc.bankInstitutionId] = url;
    }
  }

  return <AccountsPageClient accounts={accounts} locale={locale} initialBrandLogos={initialBrandLogos} />;
}
