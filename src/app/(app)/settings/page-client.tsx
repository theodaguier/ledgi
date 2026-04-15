"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPageClient({ user }: { user: { email: string; name: string | null } }) {
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    startTransition(async () => {
      try {
        await changePassword(currentPassword, newPassword);
        toast.success("Mot de passe mis à jour");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors du changement");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-[500]">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérer votre compte et vos préférences
        </p>
      </div>

      {/* Profile */}
      <Card className="card-container border border-border no-shadow">
        <CardHeader>
          <CardTitle className="text-base font-medium">Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Nom</Label>
            <Input value={user.name ?? ""} disabled className="input-pill" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Email</Label>
            <Input value={user.email} disabled className="input-pill" />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Change Password */}
      <Card className="card-container border border-border no-shadow">
        <CardHeader>
          <CardTitle className="text-base font-medium">Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Mot de passe actuel</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-pill"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Nouveau mot de passe</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-pill"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-normal">Confirmer le nouveau mot de passe</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-pill"
            />
          </div>
          <Button
            onClick={handlePasswordChange}
            disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
            className="btn-pill mt-2 w-fit"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Mise à jour...
              </>
            ) : (
              "Mettre à jour le mot de passe"
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* About */}
      <Card className="card-container border border-border no-shadow">
        <CardHeader>
          <CardTitle className="text-base font-medium">À propos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Finance Tracker v1.0.0</p>
            <p>Application personnelle de suivi de dépenses</p>
            <p className="text-xs mt-2">Stack: Next.js, shadcn/ui, Prisma, PostgreSQL, Better Auth</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
