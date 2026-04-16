"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  CategoryForm,
  CategoryIcon,
  type CategoryFormState,
} from "./category-form";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  isIncome: boolean;
  _count?: { transactions: number };
}

const EMPTY_FORM: CategoryFormState = {
  name: "",
  description: "",
  isIncome: false,
  icon: "",
  color: "",
};

export default function CategoriesPageClient({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    startTransition(async () => {
      try {
        await createCategory(
          form.name,
          form.description,
          form.isIncome,
          form.icon || undefined,
          form.color || undefined,
        );
        toast.success("Catégorie créée");
        setIsCreating(false);
        setForm(EMPTY_FORM);
        router.refresh();
      } catch {
        toast.error("Erreur lors de la création");
      }
    });
  };

  const handleUpdate = () => {
    if (!editingCat || !form.name.trim()) return;
    startTransition(async () => {
      try {
        await updateCategory(
          editingCat.id,
          form.name,
          form.description,
          form.isIncome,
          form.icon || undefined,
          form.color || undefined,
        );
        toast.success("Catégorie mise à jour");
        setEditingCat(null);
        router.refresh();
      } catch {
        toast.error("Erreur lors de la mise à jour");
      }
    });
  };

  const handleDelete = (cat: Category) => {
    setPendingDelete(cat);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    startTransition(async () => {
      try {
        await deleteCategory(pendingDelete.id);
        toast.success("Catégorie supprimée");
        router.refresh();
      } catch {
        toast.error("Erreur lors de la suppression");
      } finally {
        setPendingDelete(null);
      }
    });
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      isIncome: cat.isIncome,
      icon: cat.icon ?? "",
      color: cat.color ?? "",
    });
  };

  const expenseCategories = categories.filter((c) => !c.isIncome);
  const incomeCategories = categories.filter((c) => c.isIncome);

  return (
    <AppPageShell>
      <AppPageHeader
        title="Catégories"
        description={`${categories.length} catégorie${categories.length > 1 ? "s" : ""} configurées`}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setIsCreating(true);
            }}
            className="shrink-0"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Nouvelle catégorie
          </Button>
        }
      />

      {/* Expense Categories */}
      {expenseCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Tags className="size-4 text-muted-foreground" />
            <h2 className="text-sm">Dépenses</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expenseCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                onEdit={() => openEdit(cat)}
                onDelete={() => handleDelete(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {incomeCategories.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h2 className="text-sm">Revenus</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {incomeCategories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  onEdit={() => openEdit(cat)}
                  onDelete={() => handleDelete(cat)}
                  showIncomeBadge
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Sheet */}
      <Sheet
        open={isCreating}
        onOpenChange={(open) => !open && setIsCreating(false)}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nouvelle catégorie</SheetTitle>
            <SheetDescription>
              Créez une catégorie pour organiser vos transactions.
            </SheetDescription>
          </SheetHeader>
          <CategoryForm
            form={form}
            setForm={setForm}
            isPending={isPending}
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet
        open={!!editingCat}
        onOpenChange={(open) => !open && setEditingCat(null)}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier la catégorie</SheetTitle>
            <SheetDescription>{editingCat?.name}</SheetDescription>
          </SheetHeader>
          <CategoryForm
            form={form}
            setForm={setForm}
            isPending={isPending}
            onSubmit={handleUpdate}
            onCancel={() => setEditingCat(null)}
            isEdit
          />
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Supprimer cette catégorie ?"
        description="Les transactions associées seront décatégorisées et les règles liées supprimées. Cette action est définitive."
        confirmLabel="Supprimer"
        destructive
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </AppPageShell>
  );
}

function CategoryCard({
  cat,
  onEdit,
  onDelete,
  showIncomeBadge,
}: {
  cat: Category;
  onEdit: () => void;
  onDelete: () => void;
  showIncomeBadge?: boolean;
}) {
  return (
    <Card className="relative">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3 min-w-0">
          {cat.icon && (
            <div
              className="mt-0.5 shrink-0 flex items-center justify-center size-7 rounded-md"
              style={
                cat.color
                  ? { backgroundColor: `${cat.color}20`, color: cat.color }
                  : {
                      backgroundColor: "var(--muted)",
                      color: "var(--muted-foreground)",
                    }
              }
            >
              <CategoryIcon name={cat.icon} size={14} />
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{cat.name}</span>
              {showIncomeBadge && <Badge variant="secondary">Revenu</Badge>}
              {cat.isSystem && <Badge variant="outline">Système</Badge>}
            </div>
            {cat.description && (
              <span className="text-xs text-muted-foreground">
                {cat.description}
              </span>
            )}
            {cat._count && (
              <span className="text-xs text-muted-foreground">
                {cat._count.transactions} transaction
                {cat._count.transactions !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {!cat.isSystem && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Pencil className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
