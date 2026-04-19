"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { SheetFooter } from "@/components/ui/sheet";
import {
  Combobox,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import { InputGroupAddon, InputGroupText } from "@/components/ui/input-group";
import { PriceInput } from "@/components/ui/price-input";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getAppMessages } from "@/lib/app-messages";
import type { AppLocale } from "@/lib/locale";

interface Bank {
  id: string;
  name: string;
  bic: string;
  countries: string[];
  logo: string | null;
  brandDomain: string | null;
}

interface Account {
  name: string;
  type: string;
  bankName: string;
  bankInstitutionId: string;
  bankBrandDomain: string;
  accountNumber: string;
  referenceBalance: string;
  referenceBalanceDate: string;
  currency: string;
}

interface AccountFormProps {
  form: Account;
  setForm: React.Dispatch<React.SetStateAction<Account>>;
  locale: AppLocale;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  errors?: Record<string, string[]>;
}

interface BankItem {
  value: string;
  label: string;
  bank: Bank;
  logo: string | null;
}

function countryToFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const ACCOUNT_TYPE_VALUES = ["CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT", "OTHER"] as const;

async function fetchBanks(q?: string, signal?: AbortSignal): Promise<Bank[]> {
  const url = q ? `/api/banks?q=${encodeURIComponent(q)}` : "/api/banks";
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.banks ?? [];
}

function toBankItems(banks: Bank[]): BankItem[] {
  const seen = new Set<string>();
  return banks
    .map((bank) => ({ value: bank.id, label: bank.name, bank, logo: bank.logo }))
    .filter(({ value }) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

const MIN_QUERY_LENGTH = 3;

function useBankSearch() {
  const [items, setItems] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (q.length < MIN_QUERY_LENGTH) {
      setItems([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const banks = await fetchBanks(q, controller.signal);
        setItems(toBankItems(banks));
      } catch (err) {
        if ((err as Error).name !== "AbortError") setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { items, loading, search };
}

export function AccountForm({
  form,
  setForm,
  locale,
  isPending,
  onSubmit,
  onCancel,
  isEdit,
  errors,
}: AccountFormProps) {
  const messages = getAppMessages(locale).accounts;
  const { items: bankItems, loading, search } = useBankSearch();
  const [bankQuery, setBankQuery] = useState(form.bankName);
  const [popupOpen, setPopupOpen] = useState(false);
  const [bankFieldEl, setBankFieldEl] = useState<HTMLDivElement | null>(null);

  const selectedItem = bankItems.find((item) => item.value === form.bankInstitutionId) ?? null;

  const handleInputValueChange = (
    inputValue: string,
    eventDetails: { reason: string }
  ) => {
    if (eventDetails.reason !== "input-change" && eventDetails.reason !== "clear") return;
    setBankQuery(inputValue);
    setPopupOpen(inputValue.length >= MIN_QUERY_LENGTH);
    search(inputValue);
  };

  const handleOpenChange = (open: boolean) => {
    if (open && bankQuery.length < MIN_QUERY_LENGTH) return;
    setPopupOpen(open);
  };

  const handleValueChange = (item: BankItem | null) => {
    setBankQuery(item?.label ?? "");
    setPopupOpen(false);
    setForm((f) => ({
      ...f,
      bankName: item?.label ?? "",
      bankInstitutionId: item?.value ?? "",
      bankBrandDomain: item?.bank?.brandDomain ?? "",
    }));
  };

  const handleAddManually = () => {
    setBankQuery(bankQuery);
    setPopupOpen(false);
    setForm((f) => ({ ...f, bankName: bankQuery, bankInstitutionId: "", bankBrandDomain: "" }));
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <FieldGroup>
          <Field data-invalid={!!errors?.name}>
            <FieldLabel htmlFor="account-name" required>{messages.form.nameLabel}</FieldLabel>
            <Input
              id="account-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={messages.form.namePlaceholder}
            />
            {errors?.name && <FieldError>{errors.name[0]}</FieldError>}
          </Field>
          <Field data-invalid={!!errors?.type}>
            <FieldLabel htmlFor="account-type" required>{messages.form.typeLabel}</FieldLabel>
            <Select
              value={form.type}
              onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ACCOUNT_TYPE_VALUES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {messages.accountTypes[type]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field ref={setBankFieldEl} data-invalid={!!errors?.bankName}>
            <FieldLabel htmlFor="account-bank" required>{messages.form.bankLabel}</FieldLabel>
            <Combobox<BankItem>
              value={selectedItem}
              onValueChange={handleValueChange}
              items={bankItems}
              itemToStringLabel={(item) => item?.label ?? ""}
              isItemEqualToValue={(item, val) => item?.value === val?.value}
              onInputValueChange={handleInputValueChange}
              inputValue={bankQuery}
              open={popupOpen}
              onOpenChange={handleOpenChange}
              autoComplete="off"
            >
              <ComboboxInput
                id="account-bank"
                placeholder={messages.form.bankPlaceholder}
                showTrigger={false}
                showClear={true}
              >
                <InputGroupAddon align="inline-start">
                  <InputGroupText>
                    <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
                  </InputGroupText>
                </InputGroupAddon>
              </ComboboxInput>
              <ComboboxPopup portalProps={{ container: bankFieldEl ?? undefined }}>
                {loading && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground font-medium">
                    <Spinner className="size-3" />
                    {messages.form.bankSearching}
                  </div>
                )}
                {!loading && bankItems.length === 0 && (
                  <Empty className="border-none py-6">
                    <EmptyHeader>
                      <EmptyTitle className="text-sm">{messages.form.noBankFound}</EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onMouseDown={(e) => { e.preventDefault(); handleAddManually(); }}
                      >
                        {messages.form.addBankManually.replace("{name}", bankQuery)}
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item.value} value={item}>
                      <span className="flex items-center gap-3">
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt={item.label}
                            className="size-5 shrink-0 rounded-sm object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium truncate">{item.label}</span>
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
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
            {errors?.bankName && <FieldError>{errors.bankName[0]}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="account-number">{messages.form.accountNumberLabel}</FieldLabel>
            <Input
              id="account-number"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              placeholder={messages.form.accountNumberPlaceholder}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-balance">{messages.form.initialBalanceLabel}</FieldLabel>
            <PriceInput
              id="account-balance"
              currency={form.currency || "EUR"}
              value={form.referenceBalance}
              onChange={(v) => setForm((f) => ({ ...f, referenceBalance: v }))}
            />
          </Field>
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          {messages.form.cancel}
        </Button>
        <Button onClick={onSubmit} disabled={isPending || !form.name.trim() || !form.bankName.trim()}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {messages.form.saving}
            </>
          ) : isEdit ? (
            messages.form.save
          ) : (
            messages.form.create
          )}
        </Button>
      </SheetFooter>
    </>
  );
}
