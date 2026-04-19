"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { importCSV } from "@/actions/imports";
import { importFormSchema } from "@/lib/validation/schemas";
import { decodeCSV, detectSeparator, parseCSV } from "@/lib/csv-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Search,
  History,
  FileUp,
  AlertCircle,
  InboxIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { cn } from "@/lib/utils";

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
  bankInstitutionId: string | null;
}

interface Member {
  userId: string;
  name: string | null;
  email: string;
}

interface ImportBatch {
  id: string;
  fileName: string;
  formatDetected?: string | null;
  status: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: Date | string;
  createdByUserId?: string | null;
  bankAccount: BankAccount;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  COMPLETED: { label: "Terminé", variant: "secondary", icon: CheckCircle2 },
  FAILED: { label: "Échoué", variant: "destructive", icon: XCircle },
  PROCESSING: { label: "En cours", variant: "outline", icon: Spinner },
  PENDING: { label: "En attente", variant: "outline", icon: AlertCircle },
};

export default function ImportsPageClient({
  imports,
  accounts,
  searchParams,
  members,
  initialBrandLogos,
}: {
  imports: ImportBatch[];
  accounts: BankAccount[];
  searchParams: { q?: string; status?: string; account?: string; user?: string };
  members: Member[];
  initialBrandLogos?: Record<string, string>;
}) {
  const showUserFilter = members.length > 1;
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const searchTimeoutRef = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? "");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useOptimistic(searchParams.q ?? "");
  const [statusFilter, setStatusFilter] = useOptimistic(searchParams.status ?? "all");
  const [accountFilter, setAccountFilter] = useOptimistic(searchParams.account ?? "all");
  const [filterUser, setFilterUser] = useOptimistic(searchParams.user ?? "all");
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: string[][];
    fileName: string;
    fullContent: string;
    totalRows?: number;
  } | null>(null);

  const [brandLogos, setBrandLogos] = useState<Record<string, string>>(initialBrandLogos ?? {});

  useEffect(() => {
    const institutionIds = accounts
      .map((acc) => acc.bankInstitutionId)
      .filter((id): id is string => Boolean(id));

    if (institutionIds.length === 0) return;

    const missingIds = institutionIds.filter((id) => !initialBrandLogos?.[id]);
    if (missingIds.length === 0) return;

    import("@/lib/bank-logos-cache")
      .then(({ fetchBankLogos }) => fetchBankLogos(missingIds))
      .then((newLogos) => setBrandLogos((prev) => ({ ...prev, ...newLogos })))
      .catch(() => {});
  }, [accounts, initialBrandLogos]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const replaceSearchParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    update(params);
    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) router.replace(nextUrl);
  };

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearchQuery(value));
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => {
      startTransition(() => {
        replaceSearchParams((params) => {
          if (value.trim()) params.set("q", value.trim());
          else params.delete("q");
        });
      });
    }, 250);
  };

  const handleFilterChange = (key: "status" | "account" | "user", value: string) => {
    startTransition(() => {
      if (key === "status") setStatusFilter(value);
      else if (key === "account") setAccountFilter(value);
      else setFilterUser(value);
      replaceSearchParams((params) => {
        if (value === "all") params.delete(key);
        else params.set(key, value);
      });
    });
  };

  const handleFileChange = async (file: File | null) => {
    setUploadResult(null);
    if (!file) {
      setPreviewData(null);
      return;
    }
    const buffer = await file.arrayBuffer();
    const text = decodeCSV(buffer);
    const separator = detectSeparator(text);
    const { headers, rows } = parseCSV(text, separator);
    if (headers.length === 0 || rows.length === 0) {
      setPreviewData(null);
      return;
    }
    setPreviewData({
      headers,
      rows: rows.slice(0, 5),
      totalRows: rows.length,
      fileName: file.name,
      fullContent: text,
    });
  };

  const handleImport = async () => {
    const parsed = importFormSchema.safeParse({ accountId: selectedAccount });
    if (!parsed.success) {
      setAccountError(parsed.error.issues[0]?.message ?? "Le compte cible est requis");
      return;
    }
    setAccountError(null);
    if (!previewData || !selectedAccount) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const result = await importCSV(previewData.fullContent, previewData.fileName, selectedAccount);
      if (result.success) {
        setUploadResult({ imported: result.imported, skipped: result.skipped, errors: result.errors });
        toast.success(`${result.imported} transactions importées`);
        router.refresh();
        setPreviewData(null);
      } else {
        toast.error(result.errors[0] ?? "Import échoué");
      }
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setIsUploading(false);
    }
  };

  const step = !selectedAccount ? 1 : !previewData ? 2 : 3;

  return (
    <AppPageShell>
      <AppPageHeader
        title="Imports"
        description="Importer des transactions depuis un fichier CSV"
      />

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">
            <FileUp className="size-4" data-icon="inline-start" />
            Nouvel import
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" data-icon="inline-start" />
            Historique
            {imports.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 rounded-full px-1.5 text-[10px]">
                {imports.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Main import flow */}
            <div className="flex flex-col gap-4">
              {/* Step 1 + 2 */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuration</CardTitle>
                  <CardDescription>
                    Sélectionnez le compte cible et chargez votre fichier CSV.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {/* Step 1 — Account */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <StepBadge step={1} active={step >= 1} />
                      <Label htmlFor="import-account" required>Compte cible</Label>
                    </div>
                    <Select
                      value={selectedAccount}
                      onValueChange={(val) => { val && setSelectedAccount(val); setAccountError(null); }}
                    >
                      <SelectTrigger id="import-account">
                        <SelectValue placeholder="Sélectionner un compte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {accounts.map((acc) => {
                            const logoUrl = acc.bankInstitutionId ? (brandLogos[acc.bankInstitutionId] ?? null) : null;
                            return (
                              <SelectItem key={acc.id} value={acc.id}>
                                <span className="flex items-center gap-2">
                                  {logoUrl ? (
                                    <img src={logoUrl} alt={acc.bankName ?? ""} className="size-5 shrink-0 rounded-sm object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                  ) : null}
                                  {acc.name}
                                  {acc.bankName && (
                                    <span className="text-muted-foreground">{acc.bankName}</span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {accountError && (
                      <p className="text-sm text-destructive">{accountError}</p>
                    )}
                  </div>

                  {/* Step 2 — File */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <StepBadge step={2} active={step >= 2} />
                      <Label htmlFor="import-file">Fichier CSV</Label>
                    </div>
                    <FileUpload
                      id="import-file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      disabled={!selectedAccount}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 — Preview */}
              {previewData && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <StepBadge step={3} active />
                          <CardTitle>Aperçu</CardTitle>
                        </div>
                        <CardDescription className="pl-7">
                          {previewData.fileName} · {previewData.totalRows} lignes détectées
                        </CardDescription>
                      </div>
                      <Button
                        onClick={handleImport}
                        disabled={isUploading}
                        className="shrink-0"
                      >
                        {isUploading ? (
                          <>
                            <Spinner data-icon="inline-start" />
                            Import en cours…
                          </>
                        ) : (
                          <>
                            <Upload className="size-4" data-icon="inline-start" />
                            Importer {previewData.totalRows} transactions
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-auto">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            {previewData.headers.map((header) => (
                              <TableHead
                                key={header}
                                className="h-8 px-4 text-xs font-medium text-muted-foreground"
                              >
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.rows.map((row, rowIndex) => (
                            <TableRow key={`${previewData.fileName}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <TableCell
                                  key={`${previewData.fileName}-${rowIndex}-${cellIndex}`}
                                  className="max-w-[180px] truncate px-4 py-2"
                                >
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewData.totalRows && previewData.totalRows > 5 && (
                      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                        Affichage des 5 premières lignes sur {previewData.totalRows}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            {uploadResult && (
              <div className="flex flex-col gap-3">
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertTitle>Import terminé</AlertTitle>
                  <AlertDescription>
                    <span className="font-medium text-foreground">{uploadResult.imported}</span> importées
                    {uploadResult.skipped > 0 && (
                      <>, <span className="font-medium text-foreground">{uploadResult.skipped}</span> ignorées</>
                    )}
                  </AlertDescription>
                </Alert>
                {uploadResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="size-4" />
                    <AlertTitle>{uploadResult.errors.length} erreur{uploadResult.errors.length > 1 ? "s" : ""}</AlertTitle>
                    <AlertDescription>
                      <div className="max-h-28 overflow-y-auto">
                        {uploadResult.errors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des imports</CardTitle>
              <CardDescription>
                Tous les fichiers CSV importés dans votre espace de travail.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters toolbar */}
              <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Fichier, format, compte…"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => handleFilterChange("status", value ?? "all")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="PENDING">En attente</SelectItem>
                        <SelectItem value="PROCESSING">En cours</SelectItem>
                        <SelectItem value="COMPLETED">Terminés</SelectItem>
                        <SelectItem value="FAILED">Échoués</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    value={accountFilter}
                    onValueChange={(value) => handleFilterChange("account", value ?? "all")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Compte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Tous les comptes</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {showUserFilter && (
                    <Select
                      value={filterUser}
                      onValueChange={(value) => handleFilterChange("user", value ?? "all")}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Utilisateur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">Tous les utilisateurs</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.userId} value={member.userId}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Fichier</TableHead>
                    <TableHead>Compte</TableHead>
                    {showUserFilter && <TableHead>Importé par</TableHead>}
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={showUserFilter ? 6 : 5}>
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                          <InboxIcon className="size-8 text-muted-foreground/40" />
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Aucun import
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              Vos imports CSV apparaîtront ici.
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    imports.map((imp) => {
                      const status = STATUS_CONFIG[imp.status] ?? {
                        label: imp.status,
                        variant: "outline" as const,
                        icon: AlertCircle,
                      };
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={imp.id}>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {format(new Date(imp.createdAt), "dd/MM/yyyy")}
                            <span className="ml-1.5 text-xs opacity-60">
                              {format(new Date(imp.createdAt), "HH:mm")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="max-w-[200px] truncate font-medium">
                                {imp.fileName}
                              </span>
                              {imp.formatDetected && (
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {imp.formatDetected}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="flex items-center gap-1.5">
                              {imp.bankAccount.bankInstitutionId && brandLogos[imp.bankAccount.bankInstitutionId] ? (
                                <img
                                  src={brandLogos[imp.bankAccount.bankInstitutionId]}
                                  alt=""
                                  className="size-4 rounded object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : null}
                              <span className="truncate">{imp.bankAccount.name}</span>
                            </span>
                          </TableCell>
                          {showUserFilter && (
                            <TableCell className="text-sm text-muted-foreground">
                              {members.find((m) => m.userId === imp.createdByUserId)?.name ?? "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant={status.variant}>
                              <StatusIcon
                                className="size-3"
                                data-icon="inline-start"
                              />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="tabular-nums font-medium">
                                {imp.totalRows}
                              </span>
                              <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                                {imp.importedCount > 0 && (
                                  <span className="text-green-600 dark:text-green-400">
                                    +{imp.importedCount}
                                  </span>
                                )}
                                {imp.skippedCount > 0 && (
                                  <span>{imp.skippedCount} ign.</span>
                                )}
                                {imp.errorCount > 0 && (
                                  <span className="text-destructive">
                                    {imp.errorCount} err.
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppPageShell>
  );
}

function StepBadge({ step, active }: { step: number; active: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {step}
    </span>
  );
}
