"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { importCSV } from "@/actions/imports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
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
  createdAt: Date;
  bankAccount: BankAccount;
}

export default function ImportsPageClient({
  imports,
  accounts,
}: {
  imports: ImportBatch[];
  accounts: BankAccount[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? "");
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: string[][];
    fileName: string;
    fullContent: string;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const separator = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;

    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === separator && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1, 6).map(parseLine);

    setPreviewData({ headers, rows, fileName: file.name, fullContent: text });
  };

  const handleImport = async () => {
    if (!previewData || !selectedAccount) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await importCSV(
        previewData.fullContent,
        previewData.fileName,
        selectedAccount
      );

      if (result.success) {
        setUploadResult({
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        });
        toast.success(
          `Importé: ${result.imported} transactions, ${result.skipped} ignorées`
        );
        router.refresh();
        setPreviewData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error(result.errors[0] ?? "Import failed");
      }
    } catch (err) {
      toast.error("Erreur lors de l'import");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-[500]">Imports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importer des transactions depuis un fichier CSV
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <Card className="card-container border border-border no-shadow">
        <CardHeader>
          <CardTitle className="text-base font-medium">Nouvel import</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Compte cible</Label>
            <Select value={selectedAccount} onValueChange={(val) => val && setSelectedAccount(val)}>
              <SelectTrigger className="input-pill">
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
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Fichier CSV</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="input-pill cursor-pointer"
            />
          </div>

          {previewData && (
            <>
              <div className="rounded border border-border p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Aperçu: {previewData.fileName} ({previewData.rows.length} lignes)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {previewData.headers.map((h) => (
                          <th key={h} className="text-left px-2 py-1 text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={isUploading}
                className="btn-pill"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" data-icon="inline-start" />
                    Importer {previewData.rows.length} transactions
                  </>
                )}
              </Button>
            </>
          )}

          {uploadResult && (
            <div className="flex flex-col gap-2 p-3 rounded border border-border">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-emerald-600" />
                <span className="text-sm">
                  {uploadResult.imported} importées, {uploadResult.skipped} ignorées
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
      <Card className="card-container border border-border no-shadow">
        <CardHeader>
          <CardTitle className="text-base font-medium">Historique des imports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Date</TableHead>
                <TableHead className="text-muted-foreground text-xs">Fichier</TableHead>
                <TableHead className="text-muted-foreground text-xs">Compte</TableHead>
                <TableHead className="text-muted-foreground text-xs">Format</TableHead>
                <TableHead className="text-muted-foreground text-xs">Statut</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Importées</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Ignorées</TableHead>
                <TableHead className="text-muted-foreground text-xs text-right">Erreurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Aucun import
                  </TableCell>
                </TableRow>
              ) : (
                imports.map((imp) => (
                  <TableRow key={imp.id} className="border-border">
                    <TableCell className="text-sm py-3">
                      {format(new Date(imp.createdAt), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm py-3 max-w-[200px] truncate">
                      {imp.fileName}
                    </TableCell>
                    <TableCell className="text-sm py-3">{imp.bankAccount.name}</TableCell>
                    <TableCell className="text-sm py-3">
                      <Badge variant="secondary" className="badge-pill text-xs">
                        {imp.formatDetected ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={
                          imp.status === "COMPLETED"
                            ? "secondary"
                            : imp.status === "FAILED"
                            ? "destructive"
                            : imp.status === "PROCESSING"
                            ? "outline"
                            : "outline"
                        }
                        className="badge-pill text-xs"
                      >
                        {imp.status === "COMPLETED" && <CheckCircle className="size-3 mr-1" data-icon="inline-start" />}
                        {imp.status === "FAILED" && <XCircle className="size-3 mr-1" data-icon="inline-start" />}
                        {imp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm py-3 text-right">{imp.importedCount}</TableCell>
                    <TableCell className="text-sm py-3 text-right text-muted-foreground">
                      {imp.skippedCount}
                    </TableCell>
                    <TableCell className="text-sm py-3 text-right">
                      {imp.errorCount > 0 ? (
                        <span className="text-red-500">{imp.errorCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
