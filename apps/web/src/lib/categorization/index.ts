import type { Category, Transaction } from "@/lib/types";
import {
  matchByRules,
  matchByHistory,
  type CategoryRule,
  type CategorizationResult,
} from "./rules";
import { categorizeWithGroq } from "./llm";

/** Below this confidence → Needs Review queue */
export const CONFIDENCE_THRESHOLD = 0.75;

export function needsReview(
  categoryId: string | null,
  confidence: number | null
): boolean {
  if (!categoryId) return true;
  if (confidence === null || confidence === undefined) return true;
  return confidence < CONFIDENCE_THRESHOLD;
}

export interface CategorizeInput {
  id: string;
  merchant_name: string | null;
  description: string | null;
  amount: number;
  type: string;
}

export interface CategorizeOutput extends CategorizationResult {
  transactionId: string;
  needsReview: boolean;
}

/**
 * Hybrid pipeline per transaction batch:
 * 1. User/system rules
 * 2. Historical merchant matches
 * 3. Groq LLM for the rest
 */
export async function categorizeBatch(
  transactions: CategorizeInput[],
  categories: Category[],
  rules: CategoryRule[],
  history: { merchant_name: string | null; category_id: string | null }[]
): Promise<CategorizeOutput[]> {
  const results: (CategorizeOutput | null)[] = transactions.map(() => null);
  const needLlm: { index: number; tx: CategorizeInput }[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    const byRule = matchByRules(
      tx.merchant_name,
      tx.description,
      rules,
      categories
    );
    if (byRule.categoryId && byRule.confidence >= CONFIDENCE_THRESHOLD) {
      results[i] = {
        ...byRule,
        transactionId: tx.id,
        needsReview: needsReview(byRule.categoryId, byRule.confidence),
      };
      continue;
    }

    const byHist = matchByHistory(tx.merchant_name, history);
    if (byHist.categoryId && byHist.confidence >= CONFIDENCE_THRESHOLD) {
      results[i] = {
        ...byHist,
        transactionId: tx.id,
        needsReview: needsReview(byHist.categoryId, byHist.confidence),
      };
      continue;
    }

    // Keep weaker rule/history as fallback if LLM fails later
    if (byRule.categoryId || byHist.categoryId) {
      const fallback =
        byRule.confidence >= byHist.confidence ? byRule : byHist;
      results[i] = {
        ...fallback,
        transactionId: tx.id,
        needsReview: needsReview(fallback.categoryId, fallback.confidence),
      };
    }

    needLlm.push({ index: i, tx });
  }

  if (needLlm.length > 0) {
    // Groq in chunks of 15
    for (let c = 0; c < needLlm.length; c += 15) {
      const chunk = needLlm.slice(c, c + 15);
      const llmResults = await categorizeWithGroq(
        chunk.map(({ tx }) => ({
          merchant_name: tx.merchant_name,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
        })),
        categories
      );

      chunk.forEach(({ index, tx }, j) => {
        const llm = llmResults[j];
        const existing = results[index];

        // Prefer LLM if it has a category and higher confidence
        if (
          llm.categoryId &&
          (!existing?.categoryId || llm.confidence >= (existing.confidence ?? 0))
        ) {
          results[index] = {
            ...llm,
            transactionId: tx.id,
            needsReview: needsReview(llm.categoryId, llm.confidence),
          };
        } else if (!existing) {
          results[index] = {
            categoryId: null,
            confidence: 0,
            source: "none",
            transactionId: tx.id,
            needsReview: true,
            reason: llm.reason,
          };
        }
      });
    }
  }

  return results.map((r, i) => {
    if (r) return r;
    return {
      transactionId: transactions[i].id,
      categoryId: null,
      confidence: 0,
      source: "none" as const,
      needsReview: true,
    };
  });
}

export type { CategoryRule, CategorizationResult };
export { normalizeMerchant } from "./rules";
