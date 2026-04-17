import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seed...");

  const adminName = process.env.ADMIN_NAME ?? "Admin";
  const adminEmail = process.env.ADMIN_EMAIL ?? "theo.daguier@icloud.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Pokemon72000!";

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    console.log(`Creating admin user: ${adminEmail}`);

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        emailVerified: true,
      },
    });

    const bcryptHash = (await import("bcryptjs")).default;
    const passwordHash = await bcryptHash.hash(adminPassword, 10);

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });

    console.log("Admin user created.");
  } else {
    console.log("Admin user already exists.");
  }

  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) throw new Error("Admin user not found");

  const bcryptHash = (await import("bcryptjs")).default;
  const passwordHash = await bcryptHash.hash(adminPassword, 10);

  const existingCredentialAccount = await prisma.account.findFirst({
    where: { userId: adminUser.id, providerId: "credential" },
  });
  if (!existingCredentialAccount) {
    await prisma.account.create({
      data: {
        userId: adminUser.id,
        providerId: "credential",
        accountId: adminUser.id,
        password: passwordHash,
      },
    });
    console.log("Credential account created.");
  } else {
    console.log("Credential account already exists.");
  }

  const adminWorkspaceSlug = `personal-${adminUser.id}`;

  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: adminWorkspaceSlug },
  });

  let workspaceId: string;
  if (!existingWorkspace) {
    const ws = await prisma.workspace.create({
      data: {
        name: `${adminUser.name ?? adminUser.email}'s Space`,
        slug: adminWorkspaceSlug,
        type: "PERSONAL",
        defaultCurrency: "EUR",
      },
    });
    workspaceId = ws.id;
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: adminUser.id,
        role: "OWNER",
      },
    });
    console.log("Admin workspace created.");
  } else {
    workspaceId = existingWorkspace.id;
    console.log("Admin workspace already exists.");
  }

  const existingAccount = await prisma.bankAccount.findFirst({
    where: { workspaceId },
  });

  if (!existingAccount) {
    await prisma.bankAccount.create({
      data: {
        workspaceId,
        ownerUserId: adminUser.id,
        name: "Compte Principal",
        type: "CHECKING",
        bankName: "Generic",
        currency: "EUR",
        referenceBalance: 0,
      },
    });
    console.log("Default bank account created.");
  } else {
    await prisma.bankAccount.update({
      where: { id: existingAccount.id },
      data: { type: "CHECKING" },
    });
    console.log("Default bank account updated with type.");
  }

  const defaultCategories = [
    { name: "Logement",       slug: "logement",       isSystem: true, isIncome: false, description: "Loyer, charges, énergie",             icon: "Home",           color: "#3b82f6" },
    { name: "Courses",        slug: "courses",        isSystem: true, isIncome: false, description: "Supermarché, alimentation",            icon: "ShoppingCart",   color: "#22c55e" },
    { name: "Restaurants",    slug: "restaurants",    isSystem: true, isIncome: false, description: "Bars, restaurants, cafés",             icon: "UtensilsCrossed",color: "#f97316" },
    { name: "Transport",      slug: "transport",      isSystem: true, isIncome: false, description: "Carburant, transports en commun",      icon: "Car",            color: "#06b6d4" },
    { name: "Santé",          slug: "sante",          isSystem: true, isIncome: false, description: "Médecin, pharmacie, mutuelle",         icon: "Heart",          color: "#ef4444" },
    { name: "Abonnements",    slug: "abonnements",    isSystem: true, isIncome: false, description: "Netflix, Spotify, mobile...",          icon: "Clock",          color: "#6366f1" },
    { name: "Shopping",       slug: "shopping",       isSystem: true, isIncome: false, description: "Vêtements, électronique, divers",      icon: "ShoppingBag",    color: "#ec4899" },
    { name: "Loisirs",        slug: "loisirs",        isSystem: true, isIncome: false, description: "Sport, culture, vacances",             icon: "Music",          color: "#8b5cf6" },
    { name: "Salaire",        slug: "salaire",        isSystem: true, isIncome: true,  description: "Rémunération",                         icon: "Briefcase",      color: "#10b981" },
    { name: "Virements",      slug: "virements",      isSystem: true, isIncome: false, description: "Virements reçus et émis",              icon: "RotateCcw",      color: "#64748b" },
    { name: "Frais bancaires",slug: "frais-bancaires",isSystem: true, isIncome: false, description: "Frais de tenue de compte",             icon: "CreditCard",     color: "#f59e0b" },
    { name: "Impôts",         slug: "impots",         isSystem: true, isIncome: false, description: "Impôts et taxes",                      icon: "Percent",        color: "#dc2626" },
    { name: "Autre",          slug: "autre",          isSystem: true, isIncome: false, description: "Non catégorisé",                       icon: "Layers",         color: "#71717a" },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { workspaceId_slug: { workspaceId, slug: cat.slug } },
      update: { icon: cat.icon, color: cat.color },
      create: {
        ...cat,
        workspaceId,
      },
    });
  }
  console.log("Default categories created.");

  const categories = await prisma.category.findMany({
    where: { workspaceId },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const defaultRules = [
    { name: "CARTE", matchType: "CONTAINS" as const, pattern: "CARTE", categorySlug: "courses" },
    { name: "CARBURANT", matchType: "CONTAINS" as const, pattern: "CARBURANT", categorySlug: "transport" },
    { name: "ESSENCE", matchType: "CONTAINS" as const, pattern: "ESSENCE", categorySlug: "transport" },
    { name: "PRLV SEPA", matchType: "CONTAINS" as const, pattern: "PRLV", categorySlug: "abonnements" },
    { name: "VIREMENT", matchType: "CONTAINS" as const, pattern: "VIR", categorySlug: "virements" },
    { name: "REMBOURSEMENT", matchType: "CONTAINS" as const, pattern: "REMB", categorySlug: "autre" },
    { name: "DAB", matchType: "CONTAINS" as const, pattern: "DAB", categorySlug: "transport" },
    { name: "RESTAURANT", matchType: "CONTAINS" as const, pattern: "RESTAURANT", categorySlug: "restaurants" },
    { name: "CAFé", matchType: "CONTAINS" as const, pattern: "CAFE", categorySlug: "restaurants" },
    { name: "LOYER", matchType: "CONTAINS" as const, pattern: "LOYER", categorySlug: "logement" },
    { name: "EDF", matchType: "CONTAINS" as const, pattern: "EDF", categorySlug: "logement" },
    { name: "ENGIE", matchType: "CONTAINS" as const, pattern: "ENGIE", categorySlug: "logement" },
    { name: "PHARMACIE", matchType: "CONTAINS" as const, pattern: "PHARMACIE", categorySlug: "sante" },
    { name: "MUTUELLE", matchType: "CONTAINS" as const, pattern: "MUTUELLE", categorySlug: "sante" },
    { name: "SALAIRE", matchType: "CONTAINS" as const, pattern: "SALAIRE", categorySlug: "salaire" },
    { name: "NETFLIX", matchType: "CONTAINS" as const, pattern: "NETFLIX", categorySlug: "abonnements" },
    { name: "SPOTIFY", matchType: "CONTAINS" as const, pattern: "SPOTIFY", categorySlug: "abonnements" },
    { name: "AMAZON", matchType: "CONTAINS" as const, pattern: "AMAZON", categorySlug: "shopping" },
    { name: "DECATHLON", matchType: "CONTAINS" as const, pattern: "DECATHLON", categorySlug: "loisirs" },
    { name: "FNAC", matchType: "CONTAINS" as const, pattern: "FNAC", categorySlug: "loisirs" },
  ];

  for (let i = 0; i < defaultRules.length; i++) {
    const rule = defaultRules[i];
    const catId = catMap[rule.categorySlug];
    if (!catId) continue;

    await prisma.categorizationRule.upsert({
      where: { id: `rule-${i}` },
      update: {},
      create: {
        id: `rule-${i}`,
        workspaceId,
        name: rule.name,
        priority: i,
        matchType: rule.matchType,
        pattern: rule.pattern,
        categoryId: catId,
        isActive: true,
      },
    });
  }
  console.log("Default categorization rules created.");

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
