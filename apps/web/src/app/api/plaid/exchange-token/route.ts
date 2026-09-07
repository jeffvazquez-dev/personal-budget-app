import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaidClient, mapPlaidAccountType } from "@/lib/plaid";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { public_token } = await request.json();
    if (!public_token) {
      return NextResponse.json(
        { error: "public_token required" },
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

    const plaid = getPlaidClient();

    const exchange = await plaid.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // Institution name
    let institutionName: string | null = null;
    let institutionId: string | null = null;
    try {
      const itemRes = await plaid.itemGet({ access_token: accessToken });
      institutionId = itemRes.data.item.institution_id ?? null;
      if (institutionId) {
        const inst = await plaid.institutionsGetById({
          institution_id: institutionId,
          country_codes: ["US" as never],
        });
        institutionName = inst.data.institution.name;
      }
    } catch {
      // non-fatal
    }

    const { data: plaidItem, error: itemError } = await supabase
      .from("plaid_items")
      .upsert(
        {
          household_id: profile.household_id,
          plaid_item_id: itemId,
          access_token: accessToken,
          institution_id: institutionId,
          institution_name: institutionName,
          status: "active",
        },
        { onConflict: "plaid_item_id" }
      )
      .select("id, plaid_item_id, institution_name")
      .single();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    // Fetch accounts from Plaid
    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    const accounts = accountsRes.data.accounts;

    const inserted = [];
    for (const acct of accounts) {
      const name =
        acct.official_name ||
        acct.name ||
        `${institutionName || "Bank"} account`;

      const { data: existing } = await supabase
        .from("accounts")
        .select("id")
        .eq("plaid_account_id", acct.account_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("accounts")
          .update({
            name,
            type: mapPlaidAccountType(acct.type, acct.subtype),
            plaid_item_id: itemId,
            is_active: true,
            is_selected: true,
          })
          .eq("id", existing.id);
        inserted.push({ id: existing.id, name, plaid_account_id: acct.account_id });
      } else {
        const { data: created, error: accError } = await supabase
          .from("accounts")
          .insert({
            household_id: profile.household_id,
            name,
            type: mapPlaidAccountType(acct.type, acct.subtype),
            currency: acct.balances.iso_currency_code || "USD",
            plaid_account_id: acct.account_id,
            plaid_item_id: itemId,
            is_active: true,
            is_selected: true,
          })
          .select("id, name, plaid_account_id")
          .single();

        if (accError) {
          console.error("account insert error:", accError);
          continue;
        }
        if (created) inserted.push(created);
      }
    }

    return NextResponse.json({
      item: plaidItem,
      accounts: inserted,
      message: "Connected. Select accounts and sync transactions.",
    });
  } catch (err: unknown) {
    console.error("exchange-token error:", err);
    const message =
      err instanceof Error ? err.message : "Exchange failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
