"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  isIncome: boolean;
  _count?: { transactions: number };
}

export default function CategoriesPageClient({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", isIncome: false });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    startTransition(async () => {
      try {
        await createCategory(form.name, form.description, form.isIncome);
        toast.success("Catégorie créée");
        setIsCreating(false);
        setForm({ name: "", description: "", isIncome: false });
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
        await updateCategory(editingCat.id, form.name, form.description, form.isIncome);
        toast.success("Catégorie mise à jour");
        setEditingCat(null);
        router.refresh();
      } catch {
        toast.error("Erreur lors de la mise à jour");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success("Catégorie supprimée");
        router.refresh();
      } catch {
        toast.error("Erreur lors de la suppression");
      }
    });
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      isIncome: cat.isIncome,
    });
  };

  const expenseCategories = categories.filter((c) => !c.isIncome);
  const incomeCategories = categories.filter((c) => c.isIncome);

  const CategoryForm = ({
    category,
    onSubmit,
    onCancel,
  }: {
    category?: Category | null;
    onSubmit: () => void;
    onCancel: () => void;
  }) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Nom</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nom de la catégorie"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description optionnelle"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="formIsIncome"
          checked={form.isIncome}
          onChange={(e) => setForm({ ...form, isIncome: e.target.checked })}
          className="rounded border-input"
        />
        <Label htmlFor="formIsIncome" className="text-sm font-medium cursor-pointer">
          Catégorie de revenu
        </Label>
      </div>
      <SheetFooter className="mt-2 gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
        <Button onClick={onSubmit} disabled={isPending || !form.name.trim()}>
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Enregistrement...
            </>
          ) : category ? (
            "Enregistrer"
          ) : (
            "Créer"
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
          <h1 className="text-3xl font-semibold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} catégorie{categories.length > 1 ? "s" : ""} configurées
          </p>
        </div>
        <Button onClick={() => { setForm({ name: "", description: "", isIncome: false }); setIsCreating(true); }} className="shrink-0">
          <Plus className="size-4" data-icon="inline-start" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Expense Categories */}
      {expenseCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Tags className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Dépenses</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expenseCategories.map((cat) => (
              <Card key={cat.id} className="relative">
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.isSystem && (
                        <Badge variant="outline" className="text-[0.65rem]">Système</Badge>
                      )}
                    </div>
                    {cat.description && (
                      <span className="text-xs text-muted-foreground">{cat.description}</span>
                    )}
                    {cat._count && (
                      <span className="text-xs text-muted-foreground">
                        {cat._count.transactions} transactions
                      </span>
                    )}
                  </div>
                  {!cat.isSystem && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cat)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(cat.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {incomeCategories.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Revenus</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {incomeCategories.map((cat) => (
                <Card key={cat.id} className="relative">
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="text-[0.65rem]">Revenu</Badge>
                        {cat.isSystem && (
                          <Badge variant="outline" className="text-[0.65rem]">Système</Badge>
                        )}
                      </div>
                      {cat.description && (
                        <span className="text-xs text-muted-foreground">{cat.description}</span>
                      )}
                      {cat._count && (
                        <span className="text-xs text-muted-foreground">
                          {cat._count.transactions} transactions
                        </span>
                      )}
                    </div>
                    {!cat.isSystem && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cat)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(cat.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Sheet */}
      <Sheet open={isCreating} onOpenChange={(open) => !open && setIsCreating(false)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nouvelle catégorie</SheetTitle>
            <SheetDescription>
              Créez une catégorie pour organiser vos transactions.
            </SheetDescription>
          </SheetHeader>
          <CategoryForm onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={!!editingCat} onOpenChange={(open) => !open && setEditingCat(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Modifier la catégorie</SheetTitle>
            <SheetDescription>{editingCat?.name}</SheetDescription>
          </SheetHeader>
          <CategoryForm onSubmit={handleUpdate} onCancel={() => setEditingCat(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
