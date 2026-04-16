"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  changePassword,
  createNewApiKey,
  revokeApiKey,
  updateProfile,
  updateUserImage,
} from "@/actions/settings";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { inviteMember, cancelInvitation, removeMember } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Plus, Copy, Check, KeyRound, Star } from "lucide-react";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type PermissionLevel = "none" | "read" | "write" | "import_delete";

type Scope =
  | "transactions.read"
  | "summary.read"
  | "accounts.read"
  | "categories.read"
  | "imports.read"
  | "rules.read"
  | "transactions.write"
  | "rules.write"
  | "accounts.write"
  | "categories.write"
  | "imports.create"
  | "imports.delete";

interface PermissionConfig {
  label: string;
  levels: PermissionLevel[];
  defaultLevel: PermissionLevel;
}

const PERMISSION_CONFIG: Record<string, PermissionConfig> = {
  transactions: {
    label: "Transactions",
    levels: ["none", "read", "write"],
    defaultLevel: "read",
  },
  rules: {
    label: "Règles de catégorisation",
    levels: ["none", "read", "write"],
    defaultLevel: "none",
  },
  summary: {
    label: "Résumé / dashboard",
    levels: ["none", "read"],
    defaultLevel: "none",
  },
  accounts: {
    label: "Comptes bancaires",
    levels: ["none", "read", "write"],
    defaultLevel: "none",
  },
  categories: {
    label: "Catégories",
    levels: ["none", "read", "write"],
    defaultLevel: "none",
  },
  imports: {
    label: "Imports",
    levels: ["none", "read", "import_delete"],
    defaultLevel: "none",
  },
};

type Permissions = Record<string, PermissionLevel>;

function scopesToPermissions(scopes: string[]): Permissions {
  const permissions: Permissions = {};
  for (const resource of Object.keys(PERMISSION_CONFIG)) {
    if (resource === "summary") {
      permissions[resource] = scopes.includes("summary.read") ? "read" : "none";
    } else if (resource === "imports") {
      const hasCreate = scopes.includes("imports.create");
      const hasDelete = scopes.includes("imports.delete");
      if (hasCreate || hasDelete) {
        permissions[resource] = "import_delete";
      } else if (scopes.includes("imports.read")) {
        permissions[resource] = "read";
      } else {
        permissions[resource] = "none";
      }
    } else {
      const readScope = `${resource}.read`;
      const writeScope = `${resource}.write`;
      if (scopes.includes(writeScope)) {
        permissions[resource] = "write";
      } else if (scopes.includes(readScope)) {
        permissions[resource] = "read";
      } else {
        permissions[resource] = "none";
      }
    }
  }
  return permissions;
}

function formatPermissionLabel(
  resource: string,
  level: PermissionLevel
): string {
  if (level === "none") return "Aucun";
  if (level === "read") return "Lecture";
  if (level === "write") return "Lecture + écriture";
  if (level === "import_delete") return "Importer + supprimer";
  return level;
}

function getPermissionSummary(
  scopes: string[]
): Record<string, string> {
  const perms = scopesToPermissions(scopes);
  const summary: Record<string, string> = {};
  for (const [resource, level] of Object.entries(perms)) {
    if (level !== "none") {
      summary[resource] = formatPermissionLabel(resource, level);
    }
  }
  return summary;
}

function permissionsToScopes(perms: Permissions): Scope[] {
  const scopes: Scope[] = [];
  for (const [resource, level] of Object.entries(perms)) {
    if (level === "none") continue;
    if (resource === "summary") {
      scopes.push("summary.read");
    } else if (resource === "imports") {
      if (level === "read") scopes.push("imports.read");
      if (level === "import_delete") {
        scopes.push("imports.create");
        scopes.push("imports.delete");
      }
    } else {
      scopes.push(`${resource}.read` as Scope);
      if (level === "write") scopes.push(`${resource}.write` as Scope);
    }
  }
  return scopes;
}

function defaultPermissions(): Permissions {
  const perms: Permissions = {};
  for (const [resource, config] of Object.entries(PERMISSION_CONFIG)) {
    perms[resource] = config.defaultLevel;
  }
  return perms;
}

const VALID_TABS = ["profil", "securite", "cles-api", "partage"] as const;
type TabValue = (typeof VALID_TABS)[number];

function isValidTab(tab: string | undefined): tab is TabValue {
  return VALID_TABS.includes(tab as TabValue);
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function ProfileForm({
  user,
  onSave,
  isPending,
}: {
  user: { email: string; name: string | null; image: string | null | undefined };
  onSave: (data: { name: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(user.name ?? "");
  const router = useRouter();

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Upload failed");
    }
    const { url } = await res.json();
    await updateUserImage(url);
    router.refresh();
  };

  const handleDeleteAvatar = async () => {
    const res = await fetch("/api/profile/avatar", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Delete failed");
    }
    await updateUserImage("");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Vos informations personnelles</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <AvatarUpload
            value={user.image}
            fallback={getInitials(name || user.email)}
            onUpload={handleUpload}
            onDelete={handleDeleteAvatar}
          />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{name || "Sans nom"}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="settings-name">Nom</FieldLabel>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-email">Email</FieldLabel>
            <Input
              id="settings-email"
              value={user.email}
              disabled
              className="opacity-60"
            />
          </Field>
        </FieldGroup>

        <Button
          onClick={() => onSave({ name: name.trim() })}
          disabled={isPending || name.trim() === (user.name ?? "")}
          className="w-fit"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsContent({
  user,
  userSettings: _userSettings,
  apiKeys,
  initialTab,
  workspace,
  members,
  invitations,
}: {
  user: { email: string; name: string | null; image: string | null | undefined; id: string };
  userSettings: { locale: string; timezone: string; defaultCurrency: string; weekStartsOn: number } | null;
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  initialTab: TabValue;
  workspace: {
    id: string;
    name: string;
    type: string;
    role: string;
  };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    inviter: { name: string | null; email: string };
  }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [pendingInviteCancel, setPendingInviteCancel] = useState<string | null>(null);
  const [pendingMemberRemove, setPendingMemberRemove] = useState<string | null>(null);
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<Permissions>(defaultPermissions);
  const [newKeyExpiresDays, setNewKeyExpiresDays] = useState<string>("none");
  const [pendingCreatedKey, setPendingCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const handleTabChange = (value: string) => {
    if (!isValidTab(value)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
  };

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
        toast.error(
          err instanceof Error ? err.message : "Erreur lors du changement"
        );
      }
    });
  };

  const handleSaveProfile = (data: { name: string }) => {
    startTransition(async () => {
      try {
        await updateProfile(data);
        toast.success("Profil mis à jour");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de la mise à jour"
        );
      }
    });
  };

  const handleRevokeKey = (keyId: string) => {
    setPendingRevoke(keyId);
  };

  const confirmRevoke = () => {
    if (!pendingRevoke) return;
    startTransition(async () => {
      try {
        await revokeApiKey(pendingRevoke);
        toast.success("Clé révoquée");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de la révocation"
        );
      } finally {
        setPendingRevoke(null);
      }
    });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      try {
        await inviteMember(inviteEmail.trim(), inviteRole);
        toast.success("Invitation envoyée");
        setInviteEmail("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de l'invitation"
        );
      }
    });
  };

  const confirmCancelInvitation = () => {
    if (!pendingInviteCancel) return;
    startTransition(async () => {
      try {
        await cancelInvitation(pendingInviteCancel);
        toast.success("Invitation annulée");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de l'annulation"
        );
      } finally {
        setPendingInviteCancel(null);
      }
    });
  };

  const confirmRemoveMember = () => {
    if (!pendingMemberRemove) return;
    startTransition(async () => {
      try {
        await removeMember(pendingMemberRemove);
        toast.success("Membre retiré");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de la suppression"
        );
      } finally {
        setPendingMemberRemove(null);
      }
    });
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    startTransition(async () => {
      try {
        const scopes = permissionsToScopes(newKeyPermissions);
        const expiresDays = newKeyExpiresDays === "none" ? null : parseInt(newKeyExpiresDays);
        const { raw } = await createNewApiKey(newKeyName.trim(), scopes, expiresDays);
        setShowCreateKeyDialog(false);
        setNewKeyName("");
        setNewKeyPermissions(defaultPermissions());
        setNewKeyExpiresDays("none");
        setPendingCreatedKey(raw);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erreur lors de la création"
        );
      }
    });
  };

  const handleCopyKey = () => {
    if (!pendingCreatedKey) return;
    navigator.clipboard.writeText(pendingCreatedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <AppPageShell className="max-w-2xl">
      <AppPageHeader
        title="Paramètres"
        description="Gérer votre compte et vos préférences"
      />

      <Tabs value={initialTab} onValueChange={handleTabChange}>
        <TabsList variant="line">
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="securite">Sécurité</TabsTrigger>
          <TabsTrigger value="cles-api">Clés API</TabsTrigger>
          <TabsTrigger value="partage">Partage</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6">
          <ProfileForm
            user={user}
            onSave={handleSaveProfile}
            isPending={isPending}
          />
        </TabsContent>

        <TabsContent value="securite" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Changer le mot de passe</CardTitle>
              <CardDescription>
                Mettez à jour votre mot de passe pour sécuriser votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-password">
                    Mot de passe actuel
                  </FieldLabel>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">Nouveau mot de passe</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirmer le nouveau mot de passe
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button
                onClick={handlePasswordChange}
                disabled={
                  isPending || !currentPassword || !newPassword || !confirmPassword
                }
                className="mt-2 w-fit"
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
        </TabsContent>

        <TabsContent value="cles-api" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Clés API</CardTitle>
              <CardDescription>
                Gérez les clés qui permettent à des agents externes d&apos;accéder à vos données
              </CardDescription>
              <CardAction>
                <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="size-4" data-icon="inline-start" />
                      Nouvelle clé
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer une clé API</DialogTitle>
                      <DialogDescription>
                        Les clés permettent à des agents externes d&apos;accéder à vos données en toute sécurité.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-2">
                      <Field>
                        <FieldLabel htmlFor="key-name">Nom de la clé</FieldLabel>
                        <Input
                          id="key-name"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="ex: Agent Zapier, Script Python..."
                        />
                      </Field>

                      <div className="flex flex-col gap-3">
                        <FieldLabel>Permissions</FieldLabel>
                        <div className="flex flex-col divide-y divide-border rounded-lg border overflow-hidden">
                          {Object.entries(PERMISSION_CONFIG).map(([resource, config]) => (
                            <div key={resource} className="flex items-center justify-between px-3 py-2.5 gap-3">
                              <span className="text-sm text-foreground shrink-0">
                                {config.label}
                              </span>
                              <Select
                                value={newKeyPermissions[resource] ?? "none"}
                                onValueChange={(value) =>
                                  setNewKeyPermissions((prev) => ({
                                    ...prev,
                                    [resource]: value as PermissionLevel,
                                  }))
                                }
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {config.levels.map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {formatPermissionLabel(resource, level)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Field>
                        <FieldLabel>Expiration</FieldLabel>
                        <Select value={newKeyExpiresDays} onValueChange={setNewKeyExpiresDays}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucune expiration</SelectItem>
                            <SelectItem value="7">7 jours</SelectItem>
                            <SelectItem value="30">30 jours</SelectItem>
                            <SelectItem value="90">90 jours</SelectItem>
                            <SelectItem value="365">1 an</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
                        Annuler
                      </Button>
                      <Button
                        onClick={handleCreateKey}
                        disabled={isPending || !newKeyName.trim()}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                            Création...
                          </>
                        ) : (
                          "Créer la clé"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col px-0">
              {apiKeys.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
                  <KeyRound className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
                  <p className="text-sm font-medium">Aucune clé API</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Créez une clé pour permettre à des agents externes d&apos;accéder à vos données.
                  </p>
                </div>
              ) : (
                apiKeys.map((key, i) => {
                  const summary = getPermissionSummary(key.scopes);
                  return (
                    <>
                      {i > 0 && <Separator key={`sep-${key.id}`} />}
                      <div
                        key={key.id}
                        className="flex items-center justify-between px-6 py-3 gap-3"
                      >
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{key.name}</span>
                            <Badge variant="outline" className="font-mono shrink-0 text-xs">
                              {key.prefix}…
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {Object.keys(summary).length === 0
                              ? "Aucune permission"
                              : Object.keys(summary).map((r) => PERMISSION_CONFIG[r]?.label ?? r).join(" · ")}
                          </p>
                          {key.lastUsedAt && (
                            <p className="text-xs text-muted-foreground">
                              Utilisée le {new Date(key.lastUsedAt).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partage" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Membres</CardTitle>
              <CardDescription>
                {members?.length ?? 0} membre{(members?.length ?? 0) !== 1 ? "s" : ""} dans ce partage
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-8 rounded-full bg-muted shrink-0">
                      <span className="text-xs font-medium">
                        {member.user.name?.[0]?.toUpperCase() ?? member.user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {member.user.name ?? "Sans nom"}
                        {member.userId === user.id && (
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {member.role === "OWNER" ? "Propriétaire" : member.role === "ADMIN" ? "Admin" : "Membre"}
                    </span>
                    {member.role !== "OWNER" && workspace?.role !== "MEMBER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingMemberRemove(member.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {(workspace?.role === "OWNER" || workspace?.role === "ADMIN") && (
                <div className="border rounded-lg p-3 flex flex-col gap-3">
                  <p className="text-sm font-medium">Inviter quelqu&apos;un</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Membre</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
                      Inviter
                    </Button>
                  </div>
                </div>
              )}

              {invitations && invitations.length > 0 && (
                <>
                  <p className="text-sm font-medium pt-2">Invitations en attente</p>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="text-sm">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invité par {inv.inviter.name ?? inv.inviter.email} · expire le{" "}
                          {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      {(workspace?.role === "OWNER" || workspace?.role === "ADMIN") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingInviteCancel(inv.id)}
                          disabled={isPending}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={!!pendingRevoke}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Révoquer cette clé API ?"
        description="Elle ne pourra plus être utilisée. Cette action est irréversible."
        confirmLabel="Révoquer"
        destructive
        pending={isPending}
        onConfirm={confirmRevoke}
      />

      <ConfirmActionDialog
        open={!!pendingInviteCancel}
        onOpenChange={(open) => !open && setPendingInviteCancel(null)}
        title="Annuler cette invitation ?"
        description="Elle ne pourra plus être acceptée."
        confirmLabel="Annuler l'invitation"
        destructive
        pending={isPending}
        onConfirm={confirmCancelInvitation}
      />

      <ConfirmActionDialog
        open={!!pendingMemberRemove}
        onOpenChange={(open) => !open && setPendingMemberRemove(null)}
        title="Retirer ce membre ?"
        description="Il perdra l'accès à ce partage."
        confirmLabel="Retirer"
        destructive
        pending={isPending}
        onConfirm={confirmRemoveMember}
      />

      <Dialog open={!!pendingCreatedKey} onOpenChange={(open) => { if (!open) { setPendingCreatedKey(null); setKeyCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clé créée avec succès</DialogTitle>
            <DialogDescription>
              Copiez cette clé maintenant — vous ne pourrez plus la revoir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <code className="flex-1 bg-muted rounded-lg p-3 break-all font-mono text-sm select-all">
              {pendingCreatedKey}
            </code>
            <Button variant="outline" size="icon" className="shrink-0 mt-0" onClick={handleCopyKey}>
              {keyCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setPendingCreatedKey(null); setKeyCopied(false); }}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}

export { SettingsContent };
export type { TabValue };