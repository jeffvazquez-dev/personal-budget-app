import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/categorization";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const transactionId = body.transactionId as string | undefined;
  const categoryId = body.categoryId as string | null | undefined;

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId required" },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json({ error: "No household" }, { status: 400 });
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id, merchant_name, household_id")
    .eq("id", transactionId)
    .single();

  if (txError || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // User correction = high confidence
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      category_id: categoryId || null,
      confidence: categoryId ? 1.0 : null,
    })
    .eq("id", transactionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Learn rule from merchant when category is set
  const pattern = normalizeMerchant(tx.merchant_name);
  if (categoryId && pattern.length >= 3) {
    const { data: existing } = await supabase
      .from("category_rules")
      .select("id, hit_count")
      .eq("household_id", profile.household_id)
      .eq("pattern", pattern)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("category_rules")
        .update({
          category_id: categoryId,
          hit_count: (existing.hit_count ?? 1) + 1,
          source: "user",
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("category_rules").insert({
        household_id: profile.household_id,
        pattern,
        category_id: categoryId,
        source: "user",
        hit_count: 1,
      });
    }
  }

  return NextResponse.json({ ok: true, learnedPattern: pattern || null });
}
