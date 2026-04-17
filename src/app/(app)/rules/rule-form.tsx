"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { SheetFooter } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CategoryIcon } from "@/lib/category-icon";

export const MATCH_TYPES = [
  { value: "EXACT", label: "Exact" },
  { value: "CONTAINS", label: "Contient" },
  { value: "STARTS_WITH", label: "Commence par" },
  { value: "ENDS_WITH", label: "Finit par" },
  { value: "REGEX", label: "Expression régulière" },
  { value: "KEYWORD", label: "Mot-clé" },
];

interface RuleFormProps {
  form: {
    name: string;
    matchType: string;
    pattern: string;
    categoryId: string;
    description: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      matchType: string;
      pattern: string;
      categoryId: string;
      description: string;
    }>
  >;
  categories: { id: string; name: string; icon: string | null; color: string | null }[];
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  errors?: Record<string, string[]>;
}

export function RuleForm({
  form,
  setForm,
  categories,
  isPending,
  onSubmit,
  onCancel,
  isEdit,
  errors,
}: RuleFormProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <FieldGroup>
          <Field data-invalid={!!errors?.name}>
            <FieldLabel htmlFor="rule-name" required>Nom</FieldLabel>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nom de la règle"
            />
            {errors?.name && <FieldError>{errors.name[0]}</FieldError>}
          </Field>
          <Field data-invalid={!!errors?.matchType}>
            <FieldLabel htmlFor="rule-match-type" required>Type de match</FieldLabel>
            <Select
              value={form.matchType}
              onValueChange={(v) => v && setForm({ ...form, matchType: v })}
            >
              <SelectTrigger id="rule-match-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MATCH_TYPES.map((mt) => (
                    <SelectItem key={mt.value} value={mt.value}>
                      {mt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors?.matchType && <FieldError>{errors.matchType[0]}</FieldError>}
          </Field>
          <Field data-invalid={!!errors?.pattern}>
            <FieldLabel htmlFor="rule-pattern" required>Motif</FieldLabel>
            <Input
              id="rule-pattern"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder={
                form.matchType === "REGEX" ? "Expression régulière" : "Texte à rechercher"
              }
            />
            {errors?.pattern && <FieldError>{errors.pattern[0]}</FieldError>}
          </Field>
          <Field data-invalid={!!errors?.categoryId}>
            <FieldLabel htmlFor="rule-category" required>Catégorie cible</FieldLabel>
            <Select
              value={form.categoryId}
              onValueChange={(v) => v && setForm({ ...form, categoryId: v })}
            >
              <SelectTrigger id="rule-category">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span
                        className="size-4 shrink-0 flex items-center justify-center rounded-sm"
                        style={cat.color ? { backgroundColor: cat.color + "22" } : undefined}
                      >
                        <CategoryIcon
                          icon={cat.icon}
                          className="size-3"
                          style={cat.color ? { color: cat.color } : undefined}
                        />
                      </span>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors?.categoryId && <FieldError>{errors.categoryId[0]}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-description">Description</FieldLabel>
            <Input
              id="rule-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description optionnelle"
            />
          </Field>
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isPending || !form.name.trim() || !form.pattern.trim() || !form.categoryId}
        >
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              Enregistrement...
            </>
          ) : isEdit ? (
            "Enregistrer"
          ) : (
            "Créer la règle"
          )}
        </Button>
      </SheetFooter>
    </>
  );
}
