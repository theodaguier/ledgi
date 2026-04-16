"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SheetFooter } from "@/components/ui/sheet";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxStatus,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Bank {
  id: string;
  name: string;
  bic: string;
  countries: string[];
}

interface Account {
  name: string;
  type: string;
  bankName: string;
  accountNumber: string;
  balance: string;
  currency: string;
}

interface AccountFormProps {
  form: Account;
  setForm: React.Dispatch<React.SetStateAction<Account>>;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}

interface BankItem {
  value: string;
  label: string;
  bank: Bank;
}

function countryToFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Compte courant" },
  { value: "SAVINGS", label: "Compte d'épargne" },
  { value: "CREDIT_CARD", label: "Carte de crédit" },
  { value: "INVESTMENT", label: "Investissement" },
  { value: "OTHER", label: "Autre" },
];

async function fetchBanks(q?: string): Promise<Bank[]> {
  const url = q ? `/api/banks?q=${encodeURIComponent(q)}` : "/api/banks";
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.banks ?? [];
}

export function AccountForm({
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
  isEdit,
}: AccountFormProps) {
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bankQuery, setBankQuery] = useState(form.bankName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const comboboxWrapRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(
    () =>
      bankItems.find(
        (item) => item.label.toLowerCase() === form.bankName.toLowerCase()
      ) ?? null,
    [bankItems, form.bankName]
  );

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    let cancelled = false;
    setLoading(true);

    fetchBanks()
      .then((banks) => {
        if (cancelled || currentRequestId !== requestIdRef.current) return;
        const seen = new Set<string>();
        const items = banks
          .map((bank) => ({
            value: bank.id,
            label: bank.name,
            bank,
          }))
          .filter((item) => {
            if (seen.has(item.value)) return false;
            seen.add(item.value);
            return true;
          });
        if (selectedItem && !items.some((item) => item.value === selectedItem.value)) {
          items.unshift(selectedItem);
        }
        setBankItems(items);
      })
      .catch(() => {
        if (cancelled || currentRequestId !== requestIdRef.current) return;
        setBankItems(selectedItem ? [selectedItem] : []);
      })
      .finally(() => {
        if (!cancelled && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputValueChange = (
    inputValue: string,
    eventDetails: { reason: string }
  ) => {
    if (eventDetails.reason !== "input-change") return;
    setBankQuery(inputValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      fetchBanks(inputValue)
        .then((banks) => {
          if (currentRequestId !== requestIdRef.current) return;
          const seen = new Set<string>();
          const items = banks
            .map((bank) => ({
              value: bank.id,
              label: bank.name,
              bank,
            }))
            .filter((item) => {
              if (seen.has(item.value)) return false;
              seen.add(item.value);
              return true;
            });
          if (selectedItem && !items.some((item) => item.value === selectedItem.value)) {
            items.unshift(selectedItem);
          }
          setBankItems(items);
        })
        .catch(() => {
          if (currentRequestId !== requestIdRef.current) return;
          setBankItems(selectedItem ? [selectedItem] : []);
        })
        .finally(() => {
          if (currentRequestId === requestIdRef.current) {
            setLoading(false);
          }
        });
    }, 200);
  };

  const handleValueChange = (item: BankItem | null) => {
    if (item) {
      setBankQuery(item.label);
      setForm((f) => ({ ...f, bankName: item.label }));
    } else {
      setBankQuery("");
      setForm((f) => ({ ...f, bankName: "" }));
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="account-name">Nom du compte</FieldLabel>
            <Input
              id="account-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Compte Principal"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-type">Type de compte</FieldLabel>
            <Select
              value={form.type}
              onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="account-bank">Banque</FieldLabel>
            <div ref={comboboxWrapRef}>
              <Combobox<BankItem>
                value={selectedItem}
                onValueChange={handleValueChange}
                items={bankItems}
                itemToStringLabel={(item) => item?.label ?? ""}
                isItemEqualToValue={(item, val) => item?.value === val?.value}
                onInputValueChange={handleInputValueChange}
                inputValue={bankQuery}
                autoComplete="off"
              >
                <ComboboxInput
                  id="account-bank"
                  placeholder="Rechercher une banque..."
                  showTrigger={false}
                  showClear={true}
                />
                <ComboboxPopup
                  portalProps={{
                    container: comboboxWrapRef.current ?? undefined,
                  }}
                >
                  <ComboboxStatus>
                    {loading ? (
                      <span className="inline-flex items-center">
                        <Loader2 className="mr-1 size-3 animate-spin" />
                        Recherche en cours...
                      </span>
                    ) : null}
                  </ComboboxStatus>
                  <ComboboxEmpty>
                    {!loading && bankQuery ? "Aucune banque trouvée" : null}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.bank.bic}
                            {item.bank.countries[0] && (
                              <span className="ml-1">
                                {countryToFlag(item.bank.countries[0])}
                                {" "}
                                {item.bank.countries.join(", ")}
                              </span>
                            )}
                          </span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="account-number">Numéro de compte</FieldLabel>
            <Input
              id="account-number"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              placeholder="Optionnel"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-balance">Solde initial</FieldLabel>
            <Input
              id="account-balance"
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(e) =>
                setForm((f) => ({ ...f, balance: e.target.value }))}
              placeholder="0.00"
            />
          </Field>
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
        <Button onClick={onSubmit} disabled={isPending || !form.name.trim()}>
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Enregistrement...
            </>
          ) : isEdit ? (
            "Enregistrer"
          ) : (
            "Créer le compte"
          )}
        </Button>
      </SheetFooter>
    </>
  );
}
