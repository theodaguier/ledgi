"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { importCSV } from "@/actions/imports";
import { detectSeparator, parseCSV } from "@/lib/csv-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, CheckCircle, XCircle, Loader2, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
}

interface Member {
  userId: string;
  name: string;
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

export default function ImportsPageClient({
  imports,
  accounts,
  searchParams,
  members,
}: {
  imports: ImportBatch[];
  accounts: BankAccount[];
  searchParams: { q?: string; status?: string; account?: string; user?: string };
  members: Member[];
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
  const [searchQuery, setSearchQuery] = useOptimistic(searchParams.q ?? "");
  const [statusFilter, setStatusFilter] = useOptimistic(
    searchParams.status ?? "all"
  );
  const [accountFilter, setAccountFilter] = useOptimistic(
    searchParams.account ?? "all"
  );
  const [filterUser, setFilterUser] = useOptimistic(searchParams.user ?? "all");
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: string[][];
    fileName: string;
    fullContent: string;
    totalRows?: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const replaceSearchParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    update(params);

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl);
    }
  };

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearchQuery(value));

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      startTransition(() => {
        replaceSearchParams((params) => {
          const trimmedQuery = value.trim();

          if (trimmedQuery) {
            params.set("q", trimmedQuery);
          } else {
            params.delete("q");
          }
        });
      });
    }, 250);
  };

  const handleFilterChange = (key: "status" | "account" | "user", value: string) => {
    startTransition(() => {
      if (key === "status") {
        setStatusFilter(value);
      } else if (key === "account") {
        setAccountFilter(value);
      } else {
        setFilterUser(value);
      }

      replaceSearchParams((params) => {
        if (value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
    });
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setPreviewData(null);
      return;
    }

    const text = await file.text();
    const separator = detectSeparator(text);
    const { headers, rows } = parseCSV(text, separator);
    if (headers.length === 0 || rows.length === 0) {
      setPreviewData(null);
      return;
    }

    const previewRows = rows.slice(0, 5);
    setPreviewData({ headers, rows: previewRows, totalRows: rows.length, fileName: file.name, fullContent: text });
  };

  const handleImport = async () => {
    if (!previewData || !selectedAccount) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await importCSV(
        previewData.fullContent,
        previewData.fileName,
        selectedAccount,
      );

      if (result.success) {
        setUploadResult({
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        });
        toast.success(
          `Importé: ${result.imported} transactions, ${result.skipped} ignorées`,
        );
        router.refresh();
        setPreviewData(null);
      } else {
        toast.error(result.errors[0] ?? "Import failed");
      }
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppPageShell>
      <AppPageHeader
        title="Imports"
        description="Importer des transactions depuis un fichier CSV"
      />

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvel import</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="import-account">Compte cible</FieldLabel>
              <Select
                value={selectedAccount}
                onValueChange={(val) => val && setSelectedAccount(val)}
              >
                <SelectTrigger id="import-account">
                  <SelectValue placeholder="Sélectionner un compte" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} {acc.bankName ? `(${acc.bankName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="import-file">Fichier CSV</FieldLabel>
              <FileUpload
                id="import-file"
                accept=".csv,.txt"
                onChange={handleFileChange}
              />
            </Field>
          </FieldGroup>

          {previewData && (
            <>
              <div className="overflow-hidden rounded border border-border">
                <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  Aperçu: {previewData.fileName} ({previewData.totalRows} lignes)
                </div>
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {previewData.headers.map((header) => (
                        <TableHead key={header} className="h-auto px-2 py-2 text-xs text-muted-foreground">
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
                            className="max-w-[150px] truncate px-2 py-1 text-xs"
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleImport} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      data-icon="inline-start"
                    />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" data-icon="inline-start" />
                    Importer {previewData.totalRows} transactions
                  </>
                )}
              </Button>
            </>
          )}

          {uploadResult && (
            <div className="flex flex-col gap-2 rounded border border-border p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4" />
                <span className="text-sm">
                  {uploadResult.imported} importées, {uploadResult.skipped}{" "}
                  ignorées
                </span>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    {uploadResult.errors.length} erreurs:
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par fichier, format, compte..."
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
                <SelectTrigger className="w-[180px]">
                  <Filter className="text-muted-foreground" data-icon="inline-start" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="PROCESSING">En cours</SelectItem>
                  <SelectItem value="COMPLETED">Terminés</SelectItem>
                  <SelectItem value="FAILED">Échoués</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={accountFilter}
                onValueChange={(value) => handleFilterChange("account", value ?? "all")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous comptes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous comptes</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showUserFilter && (
                <Select
                  value={filterUser}
                  onValueChange={(value) => handleFilterChange("user", value ?? "all")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tous utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous utilisateurs</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {imports.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {imports.length} import{imports.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Date</TableHead>
                <TableHead className="text-muted-foreground text-xs">Fichier</TableHead>
                <TableHead className="text-muted-foreground text-xs">Compte</TableHead>
                {showUserFilter && (
                  <TableHead className="text-muted-foreground text-xs">Importé par</TableHead>
                )}
                <TableHead className="text-muted-foreground text-xs">Statut</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showUserFilter ? 6 : 5}
                    className="text-center text-muted-foreground py-8"
                  >
                    Aucun import
                  </TableCell>
                </TableRow>
              ) : (
                imports.map((imp) => {
                  const statusLabel: Record<string, string> = {
                    COMPLETED: "Terminé",
                    FAILED: "Échoué",
                    PROCESSING: "En cours",
                    PENDING: "En attente",
                  };
                  return (
                    <TableRow key={imp.id} className="border-border">
                      <TableCell className="py-3 text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                        {format(new Date(imp.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="max-w-[220px] truncate text-sm font-medium">
                            {imp.fileName}
                          </span>
                          {imp.formatDetected && (
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              {imp.formatDetected}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {imp.bankAccount.name}
                      </TableCell>
                      {showUserFilter && (
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {members.find((m) => m.userId === imp.createdByUserId)?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="py-3">
                        <Badge
                          variant={
                            imp.status === "COMPLETED"
                              ? "secondary"
                              : imp.status === "FAILED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {imp.status === "COMPLETED" && (
                            <CheckCircle className="size-3" data-icon="inline-start" />
                          )}
                          {imp.status === "FAILED" && (
                            <XCircle className="size-3" data-icon="inline-start" />
                          )}
                          {statusLabel[imp.status] ?? imp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium tabular-nums">
                            {imp.totalRows} transactions
                          </span>
                          <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                            <span className="text-green-600 dark:text-green-400">
                              {imp.importedCount} importées
                            </span>
                            {imp.skippedCount > 0 && (
                              <span>{imp.skippedCount} ignorées</span>
                            )}
                            {imp.errorCount > 0 && (
                              <span className="text-destructive">
                                {imp.errorCount} erreurs
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
    </AppPageShell>
  );
}