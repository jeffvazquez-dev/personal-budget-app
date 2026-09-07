import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaidClient } from "@/lib/plaid";
import type { Transaction as PlaidTransaction } from "plaid";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const itemIdFilter = body.plaid_item_id as string | undefined;

    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", user.id)
      .single();

    if (!profile?.household_id) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    let itemsQuery = supabase
      .from("plaid_items")
      .select("*")
      .eq("household_id", profile.household_id)
      .eq("status", "active");

    if (itemIdFilter) {
      itemsQuery = itemsQuery.eq("plaid_item_id", itemIdFilter);
    }

    const { data: items, error: itemsError } = await itemsQuery;
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        added: 0,
        modified: 0,
        removed: 0,
        message: "No linked Plaid items",
      });
    }

    // Selected accounts only
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, plaid_account_id, is_selected, is_active")
      .eq("household_id", profile.household_id)
      .not("plaid_account_id", "is", null);

    const selectedPlaidAccountIds = new Set(
      (accounts ?? [])
        .filter((a) => a.is_selected !== false && a.is_active !== false)
        .map((a) => a.plaid_account_id as string)
    );

    const accountIdByPlaid = new Map(
      (accounts ?? [])
        .filter((a) => a.plaid_account_id)
        .map((a) => [a.plaid_account_id as string, a.id])
    );

    const plaid = getPlaidClient();
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of items) {
      let cursor = item.cursor as string | null;
      let hasMore = true;
      const added: PlaidTransaction[] = [];
      const modified: PlaidTransaction[] = [];
      const removed: { transaction_id: string }[] = [];

      while (hasMore) {
        const res = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor: cursor || undefined,
          count: 100,
        });

        added.push(...res.data.added);
        modified.push(...res.data.modified);
        removed.push(...res.data.removed);
        hasMore = res.data.has_more;
        cursor = res.data.next_cursor;
      }

      // Upsert added + modified
      const toUpsert = [...added, ...modified].filter((tx) =>
        selectedPlaidAccountIds.has(tx.account_id)
      );

      for (const tx of toUpsert) {
        const localAccountId = accountIdByPlaid.get(tx.account_id);
        if (!localAccountId) continue;

        // Plaid: positive amount = money leaving account (expense)
        // Our model: expense negative, income positive
        const isExpense = tx.amount > 0;
        const amount = isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount);
        const type = isExpense ? "expense" : "income";

        const row = {
          household_id: profile.household_id,
          account_id: localAccountId,
          amount,
          type,
          date: tx.date,
          merchant_name: tx.merchant_name || tx.name || null,
          description: tx.name || null,
          plaid_transaction_id: tx.transaction_id,
          is_pending: tx.pending,
          // leave category/confidence for AI pipeline
        };

        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("plaid_transaction_id", tx.transaction_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("transactions")
            .update({
              amount: row.amount,
              type: row.type,
              date: row.date,
              merchant_name: row.merchant_name,
              description: row.description,
              is_pending: row.is_pending,
              deleted_at: null,
            })
            .eq("id", existing.id);
          totalModified++;
        } else {
          const { error } = await supabase.from("transactions").insert(row);
          if (!error) totalAdded++;
        }
      }

      // Soft-delete removed
      for (const r of removed) {
        const { error } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .eq("plaid_transaction_id", r.transaction_id);
        if (!error) totalRemoved++;
      }

      await supabase
        .from("plaid_items")
        .update({
          cursor,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }

    return NextResponse.json({
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      message: `Synced: ${totalAdded} added, ${totalModified} updated, ${totalRemoved} removed`,
    });
  } catch (err: unknown) {
    console.error("plaid sync error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
