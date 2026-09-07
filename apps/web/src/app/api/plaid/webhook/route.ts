import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlaidClient } from "@/lib/plaid";

/**
 * Plaid webhooks do not carry user session cookies.
 * Uses service role when available; otherwise updates cursor only via item lookup.
 * For local Sandbox, prefer manual Sync from /accounts.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookType = body.webhook_type as string | undefined;
    const webhookCode = body.webhook_code as string | undefined;
    const itemId = body.item_id as string | undefined;

    console.log("Plaid webhook:", webhookType, webhookCode, itemId);

    if (!itemId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // TRANSACTIONS / SYNC_UPDATES_AVAILABLE → trigger sync if service role configured
    if (
      webhookType === "TRANSACTIONS" &&
      (webhookCode === "SYNC_UPDATES_AVAILABLE" ||
        webhookCode === "DEFAULT_UPDATE" ||
        webhookCode === "INITIAL_UPDATE")
    ) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !serviceKey) {
        console.warn(
          "Webhook received but SUPABASE_SERVICE_ROLE_KEY not set; skip auto-sync"
        );
        return NextResponse.json({
          ok: true,
          message: "Logged; configure service role for auto-sync",
        });
      }

      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });

      const { data: item } = await admin
        .from("plaid_items")
        .select("*")
        .eq("plaid_item_id", itemId)
        .single();

      if (!item) {
        return NextResponse.json({ ok: true, message: "Unknown item" });
      }

      // Lightweight: reset nothing, caller can hit /api/plaid/sync with user session.
      // Full sync without user context is done here for selected accounts.
      const plaid = getPlaidClient();
      let cursor = item.cursor as string | null;
      let hasMore = true;
      let added = 0;

      const { data: accounts } = await admin
        .from("accounts")
        .select("id, plaid_account_id, is_selected")
        .eq("household_id", item.household_id)
        .eq("plaid_item_id", itemId);

      const selected = new Set(
        (accounts ?? [])
          .filter((a) => a.is_selected !== false && a.plaid_account_id)
          .map((a) => a.plaid_account_id as string)
      );
      const byPlaid = new Map(
        (accounts ?? [])
          .filter((a) => a.plaid_account_id)
          .map((a) => [a.plaid_account_id as string, a.id])
      );

      while (hasMore) {
        const res = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor: cursor || undefined,
          count: 100,
        });

        for (const tx of res.data.added) {
          if (!selected.has(tx.account_id)) continue;
          const accountId = byPlaid.get(tx.account_id);
          if (!accountId) continue;

          const isExpense = tx.amount > 0;
          const { data: exists } = await admin
            .from("transactions")
            .select("id")
            .eq("plaid_transaction_id", tx.transaction_id)
            .maybeSingle();

          if (exists) continue;

          await admin.from("transactions").insert({
            household_id: item.household_id,
            account_id: accountId,
            amount: isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount),
            type: isExpense ? "expense" : "income",
            date: tx.date,
            merchant_name: tx.merchant_name || tx.name || null,
            description: tx.name || null,
            plaid_transaction_id: tx.transaction_id,
            is_pending: tx.pending,
          });
          added++;
        }

        hasMore = res.data.has_more;
        cursor = res.data.next_cursor;
      }

      await admin
        .from("plaid_items")
        .update({
          cursor,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      return NextResponse.json({ ok: true, added });
    }

    if (webhookType === "ITEM" && webhookCode === "ERROR") {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && serviceKey && itemId) {
        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false },
        });
        await admin
          .from("plaid_items")
          .update({
            status: "error",
            error_code: body.error?.error_code || "ITEM_ERROR",
          })
          .eq("plaid_item_id", itemId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
