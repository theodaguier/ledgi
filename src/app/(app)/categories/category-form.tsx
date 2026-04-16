"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SheetFooter } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS: { label: string; value: string }[] = [
  { label: "Rouge", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Ambre", value: "#f59e0b" },
  { label: "Citron", value: "#eab308" },
  { label: "Vert", value: "#22c55e" },
  { label: "Émeraude", value: "#10b981" },
  { label: "Sarcelle", value: "#14b8a6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Bleu ciel", value: "#0ea5e9" },
  { label: "Bleu", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Pourpre", value: "#a855f7" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Rose", value: "#ec4899" },
  { label: "Ardoise", value: "#64748b" },
];

export const CATEGORY_ICONS: { name: string; label: string }[] = [
  // Alimentation
  { name: "UtensilsCrossed", label: "Restaurant" },
  { name: "Coffee", label: "Café" },
  { name: "Pizza", label: "Pizza" },
  { name: "Wine", label: "Vin" },
  { name: "Sandwich", label: "Sandwich" },
  { name: "IceCream2", label: "Glace" },
  { name: "Salad", label: "Salade" },
  { name: "Beef", label: "Viande" },
  { name: "Fish", label: "Poisson" },
  { name: "Apple", label: "Fruits" },
  // Transport
  { name: "Car", label: "Voiture" },
  { name: "Bus", label: "Bus" },
  { name: "Train", label: "Train" },
  { name: "Plane", label: "Avion" },
  { name: "Bike", label: "Vélo" },
  { name: "Fuel", label: "Carburant" },
  { name: "Taxi", label: "Taxi" },
  { name: "Ship", label: "Bateau" },
  // Logement
  { name: "Home", label: "Maison" },
  { name: "Building2", label: "Immeuble" },
  { name: "Wrench", label: "Réparations" },
  { name: "Zap", label: "Électricité" },
  { name: "Flame", label: "Gaz" },
  { name: "Wifi", label: "Internet" },
  { name: "Sofa", label: "Mobilier" },
  { name: "Tv", label: "TV" },
  // Santé
  { name: "Heart", label: "Santé" },
  { name: "Stethoscope", label: "Médecin" },
  { name: "Pill", label: "Pharmacie" },
  { name: "Dumbbell", label: "Sport" },
  { name: "Leaf", label: "Bien-être" },
  { name: "Eye", label: "Optique" },
  // Shopping
  { name: "ShoppingBag", label: "Shopping" },
  { name: "ShoppingCart", label: "Courses" },
  { name: "Tag", label: "Promo" },
  { name: "Gift", label: "Cadeaux" },
  { name: "Package", label: "Colis" },
  { name: "Shirt", label: "Vêtements" },
  { name: "Gem", label: "Bijoux" },
  // Finances
  { name: "CreditCard", label: "Carte" },
  { name: "PiggyBank", label: "Épargne" },
  { name: "TrendingUp", label: "Investissement" },
  { name: "Wallet", label: "Portefeuille" },
  { name: "Banknote", label: "Espèces" },
  { name: "Receipt", label: "Reçu" },
  { name: "Percent", label: "Impôts" },
  { name: "HandCoins", label: "Remboursement" },
  // Loisirs
  { name: "Music", label: "Musique" },
  { name: "Gamepad2", label: "Jeux" },
  { name: "Film", label: "Cinéma" },
  { name: "Camera", label: "Photo" },
  { name: "Headphones", label: "Audio" },
  { name: "BookOpen", label: "Livres" },
  { name: "Palette", label: "Art" },
  { name: "Ticket", label: "Événements" },
  // Éducation
  { name: "GraduationCap", label: "Études" },
  { name: "Book", label: "Formation" },
  { name: "Pencil", label: "Fournitures" },
  { name: "Monitor", label: "Cours en ligne" },
  // Voyages
  { name: "Map", label: "Carte" },
  { name: "Globe", label: "Voyages" },
  { name: "Hotel", label: "Hébergement" },
  { name: "Luggage", label: "Bagages" },
  { name: "Mountain", label: "Randonnée" },
  { name: "Sun", label: "Vacances" },
  // Famille
  { name: "Baby", label: "Enfants" },
  { name: "Dog", label: "Animaux" },
  { name: "Users", label: "Famille" },
  { name: "GraduationCap", label: "École" },
  // Communication
  { name: "Phone", label: "Téléphone" },
  { name: "Mail", label: "Courrier" },
  { name: "MessageCircle", label: "Messages" },
  // Travail
  { name: "Briefcase", label: "Travail" },
  { name: "Laptop", label: "Informatique" },
  { name: "Printer", label: "Imprimante" },
  { name: "Award", label: "Prime" },
  { name: "Trophy", label: "Bonus" },
  // Soins personnels
  { name: "Scissors", label: "Coiffeur" },
  { name: "Sparkles", label: "Beauté" },
  { name: "Bath", label: "Spa" },
  // Divers
  { name: "Star", label: "Favori" },
  { name: "Layers", label: "Divers" },
  { name: "Smile", label: "Plaisir" },
  { name: "ShieldCheck", label: "Assurance" },
  { name: "Umbrella", label: "Protection" },
  { name: "Clock", label: "Abonnement" },
  { name: "RotateCcw", label: "Récurrent" },
];

// Deduplicate by name
const seen = new Set<string>();
const ICONS = CATEGORY_ICONS.filter((i) => {
  if (seen.has(i.name)) return false;
  seen.add(i.name);
  return true;
});

function CategoryIcon({ name, size = 16 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[name] as React.ComponentType<{ size?: number }> | undefined;
  if (!Icon) return null;
  return <Icon size={size} />;
}

export { CategoryIcon };

export interface CategoryFormState {
  name: string;
  description: string;
  isIncome: boolean;
  icon: string;
  color: string;
}

interface CategoryFormProps {
  form: CategoryFormState;
  setForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}

export function CategoryForm({
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
  isEdit,
}: CategoryFormProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="category-name">Nom</FieldLabel>
            <Input
              id="category-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nom de la catégorie"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="category-description">Description</FieldLabel>
            <Input
              id="category-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description optionnelle"
            />
          </Field>

          {/* Icon picker */}
          <Field>
            <FieldLabel>Icône</FieldLabel>
            <div className="mt-1 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto rounded-lg border p-2">
              {ICONS.map((icon) => (
                <button
                  key={icon.name}
                  type="button"
                  title={icon.label}
                  onClick={() => setForm({ ...form, icon: icon.name })}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-muted",
                    form.icon === icon.name
                      ? "ring-2 ring-offset-1 ring-current"
                      : "opacity-60 hover:opacity-100"
                  )}
                  style={
                    form.icon === icon.name && form.color
                      ? { color: form.color }
                      : form.icon === icon.name
                      ? { color: "var(--foreground)" }
                      : undefined
                  }
                >
                  <CategoryIcon name={icon.name} size={16} />
                </button>
              ))}
            </div>
            {form.icon && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  style={form.color ? { color: form.color } : undefined}
                >
                  <CategoryIcon name={form.icon} size={14} />
                </span>
                <span>
                  {ICONS.find((i) => i.name === form.icon)?.label ?? form.icon}
                </span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, icon: "" })}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  Retirer
                </button>
              </div>
            )}
          </Field>

          {/* Color picker */}
          <Field>
            <FieldLabel>Couleur de surbrillance</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() =>
                    setForm({ ...form, color: form.color === c.value ? "" : c.value })
                  }
                  className={cn(
                    "size-7 rounded-full transition-transform hover:scale-110",
                    form.color === c.value
                      ? "ring-2 ring-offset-2 scale-110"
                      : ""
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            {form.color && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: form.color }}
                />
                <span>{CATEGORY_COLORS.find((c) => c.value === form.color)?.label}</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, color: "" })}
                  className="ml-auto hover:text-foreground"
                >
                  Retirer
                </button>
              </div>
            )}
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="formIsIncome"
              checked={form.isIncome}
              onCheckedChange={(checked) =>
                setForm({ ...form, isIncome: checked === true })
              }
            />
            <FieldLabel htmlFor="formIsIncome">Catégorie de revenu</FieldLabel>
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
            "Créer"
          )}
        </Button>
      </SheetFooter>
    </>
  );
}
