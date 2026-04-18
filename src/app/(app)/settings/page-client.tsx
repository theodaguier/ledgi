"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  changePassword,
  createNewApiKey,
  revokeApiKey,
  updateUserSettings,
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Copy, Check, KeyRound, Star } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { getAppMessages, type AppMessages } from "@/lib/app-messages";
import { passwordFormSchema, apiKeyFormSchema, inviteFormSchema } from "@/lib/validation/schemas";
import { LOCALE_OPTIONS, normalizeAppLocale, type AppLocale } from "@/lib/locale";
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

type SettingsMessages = AppMessages["settings"];

function getPermissionConfig(messages: SettingsMessages): Record<string, PermissionConfig> {
  return {
    transactions: {
      label: messages.apiKeys.resources.transactions,
      levels: ["none", "read", "write"],
      defaultLevel: "read",
    },
    rules: {
      label: messages.apiKeys.resources.rules,
      levels: ["none", "read", "write"],
      defaultLevel: "none",
    },
    summary: {
      label: messages.apiKeys.resources.summary,
      levels: ["none", "read"],
      defaultLevel: "none",
    },
    accounts: {
      label: messages.apiKeys.resources.accounts,
      levels: ["none", "read", "write"],
      defaultLevel: "none",
    },
    categories: {
      label: messages.apiKeys.resources.categories,
      levels: ["none", "read", "write"],
      defaultLevel: "none",
    },
    imports: {
      label: messages.apiKeys.resources.imports,
      levels: ["none", "read", "import_delete"],
      defaultLevel: "none",
    },
  };
}

type Permissions = Record<string, PermissionLevel>;

function scopesToPermissions(scopes: string[]): Permissions {
  const permissions: Permissions = {};
  for (const resource of ["transactions", "rules", "summary", "accounts", "categories", "imports"]) {
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
  level: PermissionLevel,
  messages: SettingsMessages,
): string {
  if (level === "none") return messages.apiKeys.permissionLabels.none;
  if (level === "read") return messages.apiKeys.permissionLabels.read;
  if (level === "write") return messages.apiKeys.permissionLabels.write;
  if (level === "import_delete") return messages.apiKeys.permissionLabels.import_delete;
  return level;
}

function getPermissionSummary(
  scopes: string[],
  messages: SettingsMessages,
): Record<string, string> {
  const perms = scopesToPermissions(scopes);
  const summary: Record<string, string> = {};
  for (const [resource, level] of Object.entries(perms)) {
    if (level !== "none") {
      summary[resource] = formatPermissionLabel(level, messages);
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

function defaultPermissions(config?: Record<string, PermissionConfig>): Permissions {
  const permissionConfig = config ?? getPermissionConfig(getAppMessages("fr-FR").settings);
  const perms: Permissions = {};
  for (const [resource, entry] of Object.entries(permissionConfig)) {
    perms[resource] = entry.defaultLevel;
  }
  return perms;
}

const VALID_TABS = ["profil", "interface", "securite", "cles-api", "partage"] as const;
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

function InterfaceTab({
  savedLocale,
  selectedLocale,
  onLocaleChange,
  onSaveLocale,
  isPending,
  messages,
}: {
  savedLocale: AppLocale;
  selectedLocale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  onSaveLocale: () => void;
  isPending: boolean;
  messages: SettingsMessages;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.interface.title}</CardTitle>
        <CardDescription>{messages.interface.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="settings-locale">{messages.interface.languageLabel}</FieldLabel>
            <Select
              value={selectedLocale}
              onValueChange={(value) => onLocaleChange(normalizeAppLocale(value))}
            >
              <SelectTrigger id="settings-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LOCALE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-theme">{messages.interface.themeLabel}</FieldLabel>
            <Select
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value)}
            >
              <SelectTrigger id="settings-theme" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="system">{messages.interface.themeSystem}</SelectItem>
                  <SelectItem value="light">{messages.interface.themeLight}</SelectItem>
                  <SelectItem value="dark">{messages.interface.themeDark}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <Button
          onClick={onSaveLocale}
          disabled={isPending || selectedLocale === savedLocale}
          className="w-fit"
        >
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {messages.profile.saving}
            </>
          ) : (
            messages.profile.save
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileForm({
  user,
  onSave,
  isPending,
  messages,
}: {
  user: { email: string; name: string | null; image: string | null | undefined };
  onSave: (data: { name: string }) => void;
  isPending: boolean;
  messages: SettingsMessages;
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
        <CardTitle>{messages.profile.title}</CardTitle>
        <CardDescription>{messages.profile.description}</CardDescription>
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
            <p className="text-sm font-medium">{name || messages.profile.noName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="settings-name">{messages.profile.nameLabel}</FieldLabel>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={messages.profile.namePlaceholder}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-email">{messages.profile.emailLabel}</FieldLabel>
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
              <Spinner data-icon="inline-start" />
              {messages.profile.saving}
            </>
          ) : (
            messages.profile.save
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsContent({
  user,
  userSettings,
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
  const savedLocale = normalizeAppLocale(userSettings?.locale);
  const settingsMessages = getAppMessages(savedLocale).settings;
  const permissionConfig = getPermissionConfig(settingsMessages);

  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string[]>>({});

  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [inviteErrors, setInviteErrors] = useState<Record<string, string[]>>({});
  const [pendingInviteCancel, setPendingInviteCancel] = useState<string | null>(null);
  const [pendingMemberRemove, setPendingMemberRemove] = useState<string | null>(null);
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyNameErrors, setNewKeyNameErrors] = useState<Record<string, string[]>>({});
  const [newKeyPermissions, setNewKeyPermissions] = useState<Permissions>(defaultPermissions(permissionConfig));
  const [newKeyExpiresDays, setNewKeyExpiresDays] = useState<string>("none");
  const [pendingCreatedKey, setPendingCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState(savedLocale);

  const formatShortDate = (value: string) =>
    new Intl.DateTimeFormat(savedLocale, { dateStyle: "short" }).format(new Date(value));

  const formatRole = (role: string) => {
    if (role === "OWNER") return settingsMessages.sharing.owner;
    if (role === "ADMIN") return settingsMessages.sharing.admin;
    return settingsMessages.sharing.member;
  };

  const handleTabChange = (value: string) => {
    if (!isValidTab(value)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handlePasswordChange = () => {
    const parsed = passwordFormSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      setPasswordErrors(fieldErrors);
      return;
    }
    setPasswordErrors({});

    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);
      if (result.ok) {
        toast.success(settingsMessages.security.updateSuccess);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSaveProfile = (data: { name: string }) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.ok) {
        toast.success(settingsMessages.profile.updateSuccess);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSaveLocale = () => {
    startTransition(async () => {
      try {
        await updateUserSettings({ locale: selectedLocale });
        toast.success(settingsMessages.preferences.updateSuccess);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.preferences.updateSuccess
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
        toast.success(settingsMessages.apiKeys.revokeSuccess);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.apiKeys.revokeSuccess
        );
      } finally {
        setPendingRevoke(null);
      }
    });
  };

  const handleInvite = () => {
    const parsed = inviteFormSchema.safeParse({ email: inviteEmail, role: inviteRole });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      setInviteErrors(fieldErrors);
      return;
    }
    setInviteErrors({});

    startTransition(async () => {
      try {
        await inviteMember(inviteEmail.trim(), inviteRole);
        toast.success(settingsMessages.sharing.inviteSuccess);
        setInviteEmail("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.sharing.invite
        );
      }
    });
  };

  const confirmCancelInvitation = () => {
    if (!pendingInviteCancel) return;
    startTransition(async () => {
      try {
        await cancelInvitation(pendingInviteCancel);
        toast.success(settingsMessages.sharing.cancelInviteSuccess);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.sharing.cancelInvite
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
        toast.success(settingsMessages.sharing.removeMemberSuccess);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.sharing.confirmRemoveMember
        );
      } finally {
        setPendingMemberRemove(null);
      }
    });
  };

  const handleCreateKey = () => {
    const parsed = apiKeyFormSchema.safeParse({ name: newKeyName, permissions: newKeyPermissions, expiresDays: newKeyExpiresDays });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      setNewKeyNameErrors(fieldErrors);
      return;
    }
    setNewKeyNameErrors({});

    startTransition(async () => {
      try {
        const scopes = permissionsToScopes(newKeyPermissions);
        const expiresDays = newKeyExpiresDays === "none" ? null : parseInt(newKeyExpiresDays);
        const { raw } = await createNewApiKey(newKeyName.trim(), scopes, expiresDays);
        setShowCreateKeyDialog(false);
        setNewKeyName("");
        setNewKeyPermissions(defaultPermissions(permissionConfig));
        setNewKeyExpiresDays("none");
        setPendingCreatedKey(raw);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : settingsMessages.apiKeys.create
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
        title={settingsMessages.title}
        description={settingsMessages.description}
      />

      <Tabs value={initialTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="profil">{settingsMessages.tabs.profile}</TabsTrigger>
          <TabsTrigger value="interface">{settingsMessages.tabs.interface}</TabsTrigger>
          <TabsTrigger value="securite">{settingsMessages.tabs.security}</TabsTrigger>
          <TabsTrigger value="cles-api">{settingsMessages.tabs.apiKeys}</TabsTrigger>
          <TabsTrigger value="partage">{settingsMessages.tabs.sharing}</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6 flex flex-col gap-6">
          <ProfileForm
            user={user}
            onSave={handleSaveProfile}
            isPending={isPending}
            messages={settingsMessages}
          />
        </TabsContent>

        <TabsContent value="interface" className="mt-6">
          <InterfaceTab
            savedLocale={savedLocale}
            selectedLocale={selectedLocale}
            onLocaleChange={setSelectedLocale}
            onSaveLocale={handleSaveLocale}
            isPending={isPending}
            messages={settingsMessages}
          />
        </TabsContent>

        <TabsContent value="securite" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{settingsMessages.security.title}</CardTitle>
              <CardDescription>
                {settingsMessages.security.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field data-invalid={!!passwordErrors.currentPassword}>
                  <FieldLabel htmlFor="current-password" required>
                    {settingsMessages.security.currentPassword}
                  </FieldLabel>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder={settingsMessages.security.currentPasswordPlaceholder}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordErrors({}); }}
                  />
                  {passwordErrors.currentPassword && <FieldError>{passwordErrors.currentPassword[0]}</FieldError>}
                </Field>
                <Field data-invalid={!!passwordErrors.newPassword}>
                  <FieldLabel htmlFor="new-password" required>{settingsMessages.security.newPassword}</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder={settingsMessages.security.newPasswordPlaceholder}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors({}); }}
                  />
                  {passwordErrors.newPassword && <FieldError>{passwordErrors.newPassword[0]}</FieldError>}
                </Field>
                <Field data-invalid={!!passwordErrors.confirmPassword}>
                  <FieldLabel htmlFor="confirm-password" required>
                    {settingsMessages.security.confirmPassword}
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={settingsMessages.security.confirmPasswordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors({}); }}
                  />
                  {passwordErrors.confirmPassword && <FieldError>{passwordErrors.confirmPassword[0]}</FieldError>}
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
                    <Spinner data-icon="inline-start" />
                    {settingsMessages.security.updating}
                  </>
                ) : (
                  settingsMessages.security.update
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cles-api" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{settingsMessages.apiKeys.title}</CardTitle>
              <CardDescription>
                {settingsMessages.apiKeys.description}
              </CardDescription>
              <CardAction>
                <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="size-4" data-icon="inline-start" />
                      {settingsMessages.apiKeys.newKey}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{settingsMessages.apiKeys.createTitle}</DialogTitle>
                      <DialogDescription>
                        {settingsMessages.apiKeys.createDescription}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-2">
                      <Field data-invalid={!!newKeyNameErrors.name}>
                        <FieldLabel htmlFor="key-name" required>{settingsMessages.apiKeys.keyName}</FieldLabel>
                        <Input
                          id="key-name"
                          value={newKeyName}
                          onChange={(e) => { setNewKeyName(e.target.value); setNewKeyNameErrors({}); }}
                          placeholder={settingsMessages.apiKeys.keyNamePlaceholder}
                        />
                        {newKeyNameErrors.name && <FieldError>{newKeyNameErrors.name[0]}</FieldError>}
                      </Field>

                      <div className="flex flex-col gap-3">
                        <FieldLabel>{settingsMessages.apiKeys.permissions}</FieldLabel>
                        <div className="flex flex-col divide-y divide-border rounded-lg border overflow-hidden">
                          {(Object.entries(permissionConfig) as Array<[string, PermissionConfig]>).map(([resource, config]) => (
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
                                  <SelectGroup>
                                    {config.levels.map((level) => (
                                      <SelectItem key={level} value={level}>
                                        {formatPermissionLabel(level, settingsMessages)}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Field>
                        <FieldLabel>{settingsMessages.apiKeys.expiration}</FieldLabel>
                        <Select value={newKeyExpiresDays} onValueChange={setNewKeyExpiresDays}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">{settingsMessages.apiKeys.noExpiration}</SelectItem>
                              <SelectItem value="7">{settingsMessages.apiKeys.days7}</SelectItem>
                              <SelectItem value="30">{settingsMessages.apiKeys.days30}</SelectItem>
                              <SelectItem value="90">{settingsMessages.apiKeys.days90}</SelectItem>
                              <SelectItem value="365">{settingsMessages.apiKeys.year1}</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
                        {settingsMessages.apiKeys.cancel}
                      </Button>
                      <Button
                        onClick={handleCreateKey}
                        disabled={isPending || !newKeyName.trim()}
                      >
                        {isPending ? (
                          <>
                            <Spinner data-icon="inline-start" />
                            {settingsMessages.apiKeys.creating}
                          </>
                        ) : (
                          settingsMessages.apiKeys.create
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
                  <p className="text-sm font-medium">{settingsMessages.apiKeys.noKeys}</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {settingsMessages.apiKeys.noKeysDescription}
                  </p>
                </div>
              ) : (
                apiKeys.map((key, i) => {
                  const summary = getPermissionSummary(key.scopes, settingsMessages);
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
                              ? settingsMessages.apiKeys.nonePermission
                              : Object.keys(summary).map((r) => permissionConfig[r]?.label ?? r).join(" · ")}
                          </p>
                          {key.lastUsedAt && (
                            <p className="text-xs text-muted-foreground">
                              {settingsMessages.apiKeys.lastUsedOn(formatShortDate(key.lastUsedAt))}
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
              <CardTitle>{settingsMessages.sharing.title}</CardTitle>
              <CardDescription>
                {settingsMessages.sharing.description(members?.length ?? 0)}
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
                        {member.user.name ?? settingsMessages.sharing.unnamed}
                        {member.userId === user.id && (
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {formatRole(member.role)}
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
                  <p className="text-sm font-medium">{settingsMessages.sharing.inviteTitle}</p>
                  <div className="flex flex-col gap-2">
                    <Field data-invalid={!!inviteErrors.email}>
                      <FieldLabel htmlFor="invite-email" required>{settingsMessages.sharing.inviteEmailLabel}</FieldLabel>
                      <Input
                        id="invite-email"
                        placeholder={settingsMessages.sharing.invitePlaceholder}
                        value={inviteEmail}
                        onChange={(e) => { setInviteEmail(e.target.value); setInviteErrors({}); }}
                        className="flex-1"
                      />
                      {inviteErrors.email && <FieldError>{inviteErrors.email[0]}</FieldError>}
                    </Field>
                    <div className="flex gap-2">
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="MEMBER">{settingsMessages.sharing.member}</SelectItem>
                            <SelectItem value="ADMIN">{settingsMessages.sharing.admin}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
                        {settingsMessages.sharing.invite}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {invitations && invitations.length > 0 && (
                <>
                  <p className="text-sm font-medium pt-2">{settingsMessages.sharing.pendingInvitations}</p>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="text-sm">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {settingsMessages.sharing.invitedBy(
                            inv.inviter.name ?? inv.inviter.email,
                            formatShortDate(inv.expiresAt)
                          )}
                        </p>
                      </div>
                      {(workspace?.role === "OWNER" || workspace?.role === "ADMIN") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingInviteCancel(inv.id)}
                          disabled={isPending}
                        >
                          {settingsMessages.sharing.cancelInvite}
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
        title={settingsMessages.sharing.confirmRevokeTitle}
        description={settingsMessages.sharing.confirmRevokeDescription}
        confirmLabel={settingsMessages.sharing.confirmRevoke}
        destructive
        pending={isPending}
        onConfirm={confirmRevoke}
      />

      <ConfirmActionDialog
        open={!!pendingInviteCancel}
        onOpenChange={(open) => !open && setPendingInviteCancel(null)}
        title={settingsMessages.sharing.confirmCancelInvitationTitle}
        description={settingsMessages.sharing.confirmCancelInvitationDescription}
        confirmLabel={settingsMessages.sharing.confirmCancelInvitation}
        destructive
        pending={isPending}
        onConfirm={confirmCancelInvitation}
      />

      <ConfirmActionDialog
        open={!!pendingMemberRemove}
        onOpenChange={(open) => !open && setPendingMemberRemove(null)}
        title={settingsMessages.sharing.confirmRemoveMemberTitle}
        description={settingsMessages.sharing.confirmRemoveMemberDescription}
        confirmLabel={settingsMessages.sharing.confirmRemoveMember}
        destructive
        pending={isPending}
        onConfirm={confirmRemoveMember}
      />

      <Dialog open={!!pendingCreatedKey} onOpenChange={(open) => { if (!open) { setPendingCreatedKey(null); setKeyCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{settingsMessages.apiKeys.createdTitle}</DialogTitle>
            <DialogDescription>
              {settingsMessages.apiKeys.createdDescription}
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
            <Button onClick={() => { setPendingCreatedKey(null); setKeyCopied(false); }}>{settingsMessages.apiKeys.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}

export { SettingsContent };
export type { TabValue };
