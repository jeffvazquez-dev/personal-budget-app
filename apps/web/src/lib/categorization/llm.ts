import type { Category } from "@/lib/types";
import type { CategorizationResult } from "./rules";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

interface TxInput {
  merchant_name: string | null;
  description: string | null;
  amount: number;
  type: string;
}

function buildSystemPrompt(categories: Category[]): string {
  const expense = categories
    .filter((c) => c.type === "expense" || c.type === "income")
    .map((c) => `- ${c.slug}: ${c.name}${c.parent_id ? " (sub)" : ""}`)
    .join("\n");

  return `You are a personal finance categorization assistant for a US household.
Pick the best category slug for each transaction from the allowed list only.

Allowed categories:
${expense}

Rules:
- Respond with ONLY valid JSON: an array of objects
- Each object: {"index": number, "slug": string, "confidence": number}
- confidence is 0.0 to 1.0
- Use slug "uncategorized" only if nothing fits
- Prefer specific child categories over parents when possible
- Do not invent slugs`;
}

function buildUserPrompt(txs: TxInput[]): string {
  const lines = txs.map((t, i) => {
    const amt = Math.abs(Number(t.amount)).toFixed(2);
    return `${i}. type=${t.type} amount=${amt} merchant="${t.merchant_name ?? ""}" desc="${t.description ?? ""}"`;
  });
  return `Categorize these transactions:\n${lines.join("\n")}`;
}

export async function categorizeWithGroq(
  transactions: TxInput[],
  categories: Category[]
): Promise<CategorizationResult[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return transactions.map(() => ({
      categoryId: null,
      confidence: 0,
      source: "none" as const,
      reason: "GROQ_API_KEY not configured",
    }));
  }

  if (transactions.length === 0) return [];

  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  // also allow name lowercased
  for (const c of categories) {
    slugToId.set(c.name.toLowerCase(), c.id);
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 1024,
        messages: [
          { role: "system", content: buildSystemPrompt(categories) },
          { role: "user", content: buildUserPrompt(transactions) },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Groq error:", res.status, text);
      return transactions.map(() => ({
        categoryId: null,
        confidence: 0,
        source: "none" as const,
        reason: `Groq HTTP ${res.status}`,
      }));
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "[]";

    // Extract JSON array even if model wraps in markdown
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "[]") as {
      index?: number;
      slug?: string;
      confidence?: number;
    }[];

    return transactions.map((_, i) => {
      const row = parsed.find((p) => p.index === i) ?? parsed[i];
      if (!row?.slug) {
        return {
          categoryId: null,
          confidence: 0,
          source: "llm" as const,
          reason: "No LLM suggestion",
        };
      }
      const slug = row.slug.toLowerCase().trim();
      if (slug === "uncategorized") {
        return {
          categoryId: slugToId.get("uncategorized") ?? null,
          confidence: Math.min(Number(row.confidence) || 0.4, 0.5),
          source: "llm" as const,
          reason: "LLM: uncategorized",
        };
      }
      const categoryId = slugToId.get(slug) ?? null;
      const confidence = Math.min(
        Math.max(Number(row.confidence) || 0.7, 0),
        0.92
      );
      return {
        categoryId,
        confidence: categoryId ? confidence : 0.3,
        source: "llm" as const,
        reason: categoryId
          ? `LLM: ${slug}`
          : `LLM unknown slug: ${slug}`,
      };
    });
  } catch (err) {
    console.error("Groq categorization failed:", err);
    return transactions.map(() => ({
      categoryId: null,
      confidence: 0,
      source: "none" as const,
      reason: "LLM error",
    }));
  }
}
