import { MatchType } from "@prisma/client";

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  matchedRule: string | null;
}

export type ManualDecisionMap = Map<string, string | null>;

export function buildManualDecisionKey(labelNormalized: string, type: string): string {
  return `${labelNormalized}|${type}`;
}

export async function categorizeTransaction(
  label: string,
  amount: number,
  rules: Array<{
    id: string;
    name: string;
    matchType: MatchType;
    pattern: string;
    priority: number;
    categoryId: string;
    isActive: boolean;
  }>,
  existingCategoryId?: string | null,
  manualDecisions?: ManualDecisionMap
): Promise<CategorizationResult> {
  if (existingCategoryId !== undefined && existingCategoryId !== null) {
    return { categoryId: existingCategoryId, confidence: 1.0, matchedRule: null };
  }

  const normalizedLabel = label.toLowerCase().trim();

  if (manualDecisions && manualDecisions.size > 0) {
    const debitKey = buildManualDecisionKey(normalizedLabel, "DEBIT");
    const creditKey = buildManualDecisionKey(normalizedLabel, "CREDIT");
    const manualCategoryId = manualDecisions.get(debitKey) ?? manualDecisions.get(creditKey);
    if (manualCategoryId !== undefined) {
      return { categoryId: manualCategoryId, confidence: 0.95, matchedRule: null };
    }
    if (manualDecisions.has(debitKey) || manualDecisions.has(creditKey)) {
      return { categoryId: null, confidence: 0, matchedRule: null };
    }
  }

  const sortedRules = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    const pattern = rule.pattern.toLowerCase();
    let matched = false;

    switch (rule.matchType) {
      case "EXACT":
        matched = normalizedLabel === pattern;
        break;
      case "CONTAINS":
        matched = normalizedLabel.includes(pattern);
        break;
      case "STARTS_WITH":
        matched = normalizedLabel.startsWith(pattern);
        break;
      case "ENDS_WITH":
        matched = normalizedLabel.endsWith(pattern);
        break;
      case "REGEX":
        try {
          matched = new RegExp(pattern, "i").test(normalizedLabel);
        } catch {
          matched = false;
        }
        break;
      case "KEYWORD":
        const keywords = pattern.split(/\s+/).filter(Boolean);
        matched = keywords.some((kw) => normalizedLabel.includes(kw));
        break;
    }

    if (matched) {
      return {
        categoryId: rule.categoryId,
        confidence: 0.85,
        matchedRule: rule.id,
      };
    }
  }

  const heuristicResult = applyHeuristics(label, amount);
  return {
    categoryId: heuristicResult.categoryId,
    confidence: heuristicResult.confidence,
    matchedRule: null,
  };
}

interface HeuristicResult {
  categoryId: string | null;
  confidence: number;
}

const HEURISTIC_PATTERNS: Array<{
  patterns: RegExp[];
  categorySlug: string;
  confidence: number;
}> = [
  {
    patterns: [/cb\s*\d/i, /carte\s*\d/i, /paiement\s*cb/i, /cb\d{4}/i],
    categorySlug: "courses",
    confidence: 0.4,
  },
  {
    patterns: [/carburant/i, /essence/i, /shell/i, /totalenergies/i, /esso/i, /bp/i],
    categorySlug: "transport",
    confidence: 0.5,
  },
  {
    patterns: [/prlv/i, /prelevement/i, /sepa/i],
    categorySlug: "abonnements",
    confidence: 0.5,
  },
  {
    patterns: [/virement/i, /\bvir\b/i],
    categorySlug: "virements",
    confidence: 0.6,
  },
  {
    patterns: [/remboursement/i, /remb/i],
    categorySlug: "autre",
    confidence: 0.3,
  },
  {
    patterns: [/dab/i, /distributeur/i, /retrait/i],
    categorySlug: "transport",
    confidence: 0.4,
  },
  {
    patterns: [/restaurant/i, /bistro/i, /brasserie/i, /cafe/i, /café/i],
    categorySlug: "restaurants",
    confidence: 0.5,
  },
  {
    patterns: [/pharmacie/i, /docteur/i, /medecin/i, /médecin/i, /kiné/i],
    categorySlug: "sante",
    confidence: 0.6,
  },
  {
    patterns: [/loyer/i, /immobilier/i],
    categorySlug: "logement",
    confidence: 0.6,
  },
  {
    patterns: [/edf/i, /engie/i, /energie/i, /electricite/i, /gaz/i, /veolia/i],
    categorySlug: "logement",
    confidence: 0.5,
  },
  {
    patterns: [/netflix/i, /spotify/i, /apple\s*(music|tv)/i, /disney/i, /amazon\s*prime/i],
    categorySlug: "abonnements",
    confidence: 0.6,
  },
  {
    patterns: [/salaire/i, /paie/i, /remuneration/i],
    categorySlug: "salaire",
    confidence: 0.7,
  },
  {
    patterns: [/frais/i, /commission/i, /tenue\s*compte/i],
    categorySlug: "frais-bancaires",
    confidence: 0.5,
  },
  {
    patterns: [/impot/i, /impôt/i, /taxe/i, /prelevement\s*fiscal/i],
    categorySlug: "impots",
    confidence: 0.7,
  },
  {
    patterns: [/amazon/i, /cdiscount/i, /fnac/i, /darty/i],
    categorySlug: "shopping",
    confidence: 0.4,
  },
  {
    patterns: [/decathlon/i, /intersport/i, /go sport/i],
    categorySlug: "loisirs",
    confidence: 0.5,
  },
];

function applyHeuristics(label: string, _amount: number): HeuristicResult {
  const normalizedLabel = label.toLowerCase();

  for (const heuristic of HEURISTIC_PATTERNS) {
    for (const pattern of heuristic.patterns) {
      if (pattern.test(normalizedLabel)) {
        return {
          categoryId: null,
          confidence: heuristic.confidence,
        };
      }
    }
  }

  return { categoryId: null, confidence: 0 };
}

export function normalizeLabel(label: string): string {
  return label
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-àâäéèêëïîôûùüÿœæç]/gi, " ")
    .trim()
    .toLowerCase();
}

export function extractMerchant(label: string): string | null {
  const cleaned = label
    .replace(/cb\s*\*?\d{4}/gi, "")
    .replace(/carte\s*\d{4}/gi, "")
    .replace(/\d{2}\/\d{2}/g, "")
    .replace(/\d{4,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2) return null;

  const words = cleaned.split(" ").slice(0, 3);
  return words.join(" ");
}
