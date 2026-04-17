"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
} from "@/actions/rules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { RuleForm, MATCH_TYPES } from "./rule-form";
import { ruleFormSchema } from "@/lib/validation/schemas";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";

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
  icon: string | null;
  color: string | null;
}

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
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    name: "",
    matchType: "CONTAINS",
    pattern: "",
    categoryId: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = (isEdit: boolean) => {
    const parsed = ruleFormSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});

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

  const handleDelete = (rule: Rule) => {
    setPendingDelete(rule);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    startTransition(async () => {
      try {
        await deleteRule(pendingDelete.id);
        toast.success("Règle supprimée");
        router.refresh();
      } catch {
        toast.error("Erreur lors de la suppression");
      } finally {
        setPendingDelete(null);
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
    setForm({
      name: "",
      matchType: "CONTAINS",
      pattern: "",
      categoryId: "",
      description: "",
    });
    setFormErrors({});
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

  return (
    <AppPageShell>
      <AppPageHeader
        title="Règles"
        description={`${rules.length} règle${rules.length > 1 ? "s" : ""} configurée${rules.length > 1 ? "s" : ""}`}
        actions={
          <Button
            onClick={() => {
              setForm({
                name: "",
                matchType: "CONTAINS",
                pattern: "",
                categoryId: "",
                description: "",
              });
              setIsCreating(true);
            }}
            className="shrink-0"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Nouvelle règle
          </Button>
        }
      />

      {/* Rules List */}
      <Card>
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
                  className="group flex items-start justify-between gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <Badge variant="secondary">
                        {MATCH_TYPES.find((m) => m.value === rule.matchType)
                          ?.label ?? rule.matchType}
                      </Badge>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {rule.pattern}
                      </code>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Badge variant="outline">{rule.category.name}</Badge>
                      {rule.priority === 0 && (
                        <Badge variant="outline">Priorité haute</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <span className="text-xs text-muted-foreground">
                        {rule.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() =>
                        handleToggle(rule.id, rule.isActive)
                      }
                      disabled={isPending}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(rule)}>
                          <Pencil />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(rule)}
                        >
                          <Trash2 />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Sheet */}
      <Sheet
        open={isCreating}
        onOpenChange={(open) => !open && setIsCreating(false)}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nouvelle règle</SheetTitle>
            <SheetDescription>
              Créez une règle pour catégoriser automatiquement vos transactions.
            </SheetDescription>
          </SheetHeader>
          <RuleForm
            form={form}
            setForm={setForm}
            categories={categories}
            isPending={isPending}
            onSubmit={() => handleSubmit(false)}
            onCancel={resetForm}
            errors={formErrors}
          />
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier la règle</SheetTitle>
            <SheetDescription>{editingRule?.name}</SheetDescription>
          </SheetHeader>
          <RuleForm
            form={form}
            setForm={setForm}
            categories={categories}
            isPending={isPending}
            onSubmit={() => handleSubmit(true)}
            onCancel={() => setEditingRule(null)}
            isEdit
            errors={formErrors}
          />
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette règle ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        destructive
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </AppPageShell>
  );
}
