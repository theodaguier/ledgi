import { z } from "zod";

export const accountFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT", "OTHER"], {
    message: "Le type de compte est requis",
  }),
  bankName: z.string().min(1, "La banque est requise"),
  bankInstitutionId: z.string().nullish(),
  bankBrandDomain: z.string().nullish(),
  accountNumber: z.string().nullish(),
  referenceBalance: z.string().nullish(),
  referenceBalanceDate: z.string().nullish(),
  currency: z.string().default("EUR"),
});

export type AccountFormData = z.infer<typeof accountFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  isIncome: z.boolean().default(false),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;

export const ruleFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  matchType: z.enum(["EXACT", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "REGEX", "KEYWORD"], {
    message: "Le type de match est requis",
  }),
  pattern: z.string().min(1, "Le motif est requis"),
  categoryId: z.string().min(1, "La catégorie est requise"),
  description: z.string().optional(),
});

export type RuleFormData = z.infer<typeof ruleFormSchema>;

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string().min(1, "Veuillez confirmer le mot de passe"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type PasswordFormData = z.infer<typeof passwordFormSchema>;

export const apiKeyFormSchema = z.object({
  name: z.string().min(1, "Le nom de la clé est requis"),
  permissions: z.record(z.string(), z.enum(["none", "read", "write", "import_delete"])).optional(),
  expiresDays: z.string().optional(),
});

export type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

export const inviteFormSchema = z.object({
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export type InviteFormData = z.infer<typeof inviteFormSchema>;

export const importFormSchema = z.object({
  accountId: z.string().min(1, "Le compte cible est requis"),
});

export type ImportFormData = z.infer<typeof importFormSchema>;
