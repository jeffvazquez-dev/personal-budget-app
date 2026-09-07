import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { categorizeBatch, CONFIDENCE_THRESHOLD } from "@/lib/categorization";
import type { CategoryRule } from "@/lib/categorization";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 100);
  const onlyUncategorized = body.onlyUncategorized !== false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: "No household" }, { status: 400 });
  }

  const [categoriesRes, rulesRes, historyRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("category_rules").select("*"),
    supabase
      .from("transactions")
      .select("merchant_name, category_id")
      .is("deleted_at", null)
      .not("category_id", "is", null)
      .not("merchant_name", "is", null)
      .limit(500),
  ]);

  const categories = categoriesRes.data ?? [];
  const rules = (rulesRes.data ?? []) as CategoryRule[];
  const history = historyRes.data ?? [];

  // Candidates: uncategorized OR low confidence
  let query = supabase
    .from("transactions")
    .select("id, merchant_name, description, amount, type, category_id, confidence")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(limit);

  if (onlyUncategorized) {
    query = query.or(
      `category_id.is.null,confidence.lt.${CONFIDENCE_THRESHOLD}`
    );
  }

  const { data: txs, error: txError } = await query;
  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  if (!txs || txs.length === 0) {
    return NextResponse.json({
      processed: 0,
      updated: 0,
      needsReview: 0,
      message: "Nothing to categorize",
    });
  }

  const results = await categorizeBatch(
    txs.map((t) => ({
      id: t.id,
      merchant_name: t.merchant_name,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
    })),
    categories,
    rules,
    history
  );

  let updated = 0;
  let needsReviewCount = 0;

  for (const r of results) {
    if (r.needsReview) needsReviewCount++;

    const { error } = await supabase
      .from("transactions")
      .update({
        category_id: r.categoryId,
        confidence: r.confidence,
      })
      .eq("id", r.transactionId);

    if (!error) updated++;
  }

  return NextResponse.json({
    processed: results.length,
    updated,
    needsReview: needsReviewCount,
    threshold: CONFIDENCE_THRESHOLD,
    sample: results.slice(0, 5).map((r) => ({
      id: r.transactionId,
      categoryId: r.categoryId,
      confidence: r.confidence,
      source: r.source,
      reason: r.reason,
      needsReview: r.needsReview,
    })),
  });
}
