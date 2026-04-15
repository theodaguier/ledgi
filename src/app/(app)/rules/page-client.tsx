"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRule, updateRule, deleteRule, toggleRule } from "@/actions/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  name: string;
  matchType: string;
  pattern: string;
  priority: number;
  isActive: boolean;
  description: string | null;
  category: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
}

const MATCH_TYPES = [
  { value: "EXACT", label: "Exact" },
  { value: "CONTAINS", label: "Contient" },
  { value: "STARTS_WITH", label: "Commence par" },
  { value: "ENDS_WITH", label: "Finit par" },
  { value: "REGEX", label: "Expression régulière" },
  { value: "KEYWORD", label: "Mot-clé" },
];

export default function RulesPageClient({
  rules,
  categories,
}: {
  rules: Rule[];
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    name: "",
    matchType: "CONTAINS",
    pattern: "",
    categoryId: "",
    description: "",
  });

  const handleSubmit = (isEdit: boolean) => {
    if (!form.name.trim() || !form.pattern.trim() || !form.categoryId) return;

    startTransition(async () => {
      try {
        if (isEdit && editingRule) {
          await updateRule(editingRule.id, form);
          toast.success("Règle mise à jour");
        } else {
          await createRule(form);
          toast.success("Règle créée");
        }
        resetForm();
        router.refresh();
      } catch {
        toast.error("Erreur lors de l'enregistrement");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteRule(id);
        toast.success("Règle supprimée");
        router.refresh();
      } catch {
        toast.error("Erreur lors de la suppression");
      }
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    startTransition(async () => {
      try {
        await toggleRule(id, !isActive);
        toast.success(isActive ? "Règle désactivée" : "Règle activée");
        router.refresh();
      } catch {
        toast.error("Erreur");
      }
    });
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingRule(null);
    setForm({ name: "", matchType: "CONTAINS", pattern: "", categoryId: "", description: "" });
  };

  const openEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      matchType: rule.matchType,
      pattern: rule.pattern,
      categoryId: rule.category.id,
      description: rule.description ?? "",
    });
  };

  const RuleForm = ({
    rule,
    onSubmit,
    onCancel,
  }: {
    rule?: Rule | null;
    onSubmit: () => void;
    onCancel: () => void;
  }) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Nom</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nom de la règle"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Type de match</Label>
        <Select
          value={form.matchType}
          onValueChange={(v) => v && setForm({ ...form, matchType: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map((mt) => (
              <SelectItem key={mt.value} value={mt.value}>
                {mt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Motif</Label>
        <Input
          value={form.pattern}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          placeholder={
            form.matchType === "REGEX" ? "Expression régulière" : "Texte à rechercher"
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Catégorie cible</Label>
        <Select
          value={form.categoryId}
          onValueChange={(v) => v && setForm({ ...form, categoryId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description optionnelle"
        />
      </div>
      <SheetFooter className="mt-2 gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isPending || !form.name.trim() || !form.pattern.trim() || !form.categoryId}
        >
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Enregistrement...
            </>
          ) : rule ? (
            "Enregistrer"
          ) : (
            "Créer la règle"
          )}
        </Button>
      </SheetFooter>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Règles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rules.length} règle{rules.length > 1 ? "s" : ""} configurée{rules.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setForm({ name: "", matchType: "CONTAINS", pattern: "", categoryId: "", description: "" }); setIsCreating(true); }} className="shrink-0">
          <Plus className="size-4" data-icon="inline-start" />
          Nouvelle règle
        </Button>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            Toutes les règles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {rules.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  Aucune règle configurée
                </p>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between gap-4 p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <Badge variant="secondary" className="text-[0.65rem]">
                        {MATCH_TYPES.find((m) => m.value === rule.matchType)?.label ??
                          rule.matchType}
                      </Badge>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {rule.pattern}
                      </code>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Badge variant="outline" className="text-[0.65rem]">
                        {rule.category.name}
                      </Badge>
                      {rule.priority === 0 && (
                        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                          Priorité haute
                        </Badge>
                      )}
                    </div>
                    {rule.description && (
                      <span className="text-xs text-muted-foreground">{rule.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggle(rule.id, rule.isActive)}
                      disabled={isPending}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(rule)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(rule.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Sheet */}
      <Sheet open={isCreating} onOpenChange={(open) => !open && setIsCreating(false)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nouvelle règle</SheetTitle>
            <SheetDescription>
              Créez une règle pour catégoriser automatiquement vos transactions.
            </SheetDescription>
          </SheetHeader>
          <RuleForm onSubmit={() => handleSubmit(false)} onCancel={resetForm} />
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier la règle</SheetTitle>
            <SheetDescription>{editingRule?.name}</SheetDescription>
          </SheetHeader>
          <RuleForm onSubmit={() => handleSubmit(true)} onCancel={() => setEditingRule(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
