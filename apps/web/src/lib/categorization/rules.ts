import type { Category } from "@/lib/types";

export interface CategoryRule {
  id: string;
  household_id: string;
  pattern: string;
  category_id: string;
  source: string;
  hit_count: number;
}

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  source: "rule" | "history" | "llm" | "none";
  reason?: string;
}

/** Normalize merchant names for matching */
export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /\b(inc|llc|ltd|co|corp|store|#\d+|\d{4,})\b/g,
      " "
    )
    .trim();
}

/** Built-in keyword hints (US-centric defaults) */
const SYSTEM_KEYWORDS: { pattern: RegExp; slugHints: string[] }[] = [
  { pattern: /publix|whole\s*foods|trader\s*joe|kroger|aldi|walmart|costco|target\s*grocery|grocery/, slugHints: ["groceries", "food"] },
  { pattern: /mcdonald|starbucks|chipotle|restaurant|cafe|coffee|doordash|uber\s*eats|grubhub/, slugHints: ["dining-out", "food"] },
  { pattern: /shell|chevron|exxon|bp\b|gas\s*station|fuel/, slugHints: ["gas-oil", "transportation"] },
  { pattern: /uber|lyft|parking|toll/, slugHints: ["parking-tolls", "transportation"] },
  { pattern: /netflix|spotify|hulu|disney|youtube/, slugHints: ["movies", "recreation"] },
  { pattern: /pharmacy|cvs|walgreens|prescription/, slugHints: ["prescriptions", "medical"] },
  { pattern: /payroll|direct\s*dep|salary|paycheck/, slugHints: ["income", "jeff-net-income", "alina-net-income"] },
  { pattern: /amazon/, slugHints: ["miscellaneous", "uncategorized"] },
  { pattern: /comcast|verizon|att\b|t-mobile|spectrum/, slugHints: ["internet", "cell-phone", "housing"] },
  { pattern: /fpl|duke\s*energy|electric|utility/, slugHints: ["electric", "gas-utility", "housing"] },
];

function findCategoryBySlugHints(
  categories: Category[],
  hints: string[]
): Category | undefined {
  for (const hint of hints) {
    const found = categories.find(
      (c) => c.slug === hint || c.name.toLowerCase().includes(hint.replace(/-/g, " "))
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Rule engine: user rules first, then system keyword hints.
 * Returns high confidence when matched.
 */
export function matchByRules(
  merchantName: string | null,
  description: string | null,
  rules: CategoryRule[],
  categories: Category[]
): CategorizationResult {
  const haystack = normalizeMerchant(
    [merchantName, description].filter(Boolean).join(" ")
  );
  if (!haystack) {
    return { categoryId: null, confidence: 0, source: "none" };
  }

  // User / learned rules (longest pattern first = more specific)
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const rule of sorted) {
    const pattern = normalizeMerchant(rule.pattern);
    if (pattern && haystack.includes(pattern)) {
      return {
        categoryId: rule.category_id,
        confidence: 0.95,
        source: "rule",
        reason: `Matched rule: ${rule.pattern}`,
      };
    }
  }

  // System keyword heuristics
  for (const kw of SYSTEM_KEYWORDS) {
    if (kw.pattern.test(haystack)) {
      const cat = findCategoryBySlugHints(categories, kw.slugHints);
      if (cat) {
        return {
          categoryId: cat.id,
          confidence: 0.8,
          source: "rule",
          reason: `Keyword match → ${cat.name}`,
        };
      }
    }
  }

  return { categoryId: null, confidence: 0, source: "none" };
}

/**
 * Learn from historical transactions: same normalized merchant → most common category
 */
export function matchByHistory(
  merchantName: string | null,
  history: { merchant_name: string | null; category_id: string | null }[]
): CategorizationResult {
  const target = normalizeMerchant(merchantName);
  if (!target || target.length < 3) {
    return { categoryId: null, confidence: 0, source: "none" };
  }

  const counts = new Map<string, number>();
  for (const h of history) {
    if (!h.category_id) continue;
    const m = normalizeMerchant(h.merchant_name);
    if (m && (m.includes(target) || target.includes(m))) {
      counts.set(h.category_id, (counts.get(h.category_id) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    return { categoryId: null, confidence: 0, source: "none" };
  }

  let bestId = "";
  let bestCount = 0;
  let total = 0;
  for (const [id, count] of counts) {
    total += count;
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  }

  const confidence = Math.min(0.9, 0.6 + (bestCount / total) * 0.3);
  return {
    categoryId: bestId,
    confidence,
    source: "history",
    reason: `Seen ${bestCount}x before`,
  };
}
