import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPlaidClient,
  PLAID_PRODUCTS,
  PLAID_COUNTRY_CODES,
} from "@/lib/plaid";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Personal Budget App",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    console.error("create-link-token error:", err);
    const message =
      err && typeof err === "object" && "response" in err
        ? JSON.stringify(
            (err as { response?: { data?: unknown } }).response?.data
          )
        : err instanceof Error
          ? err.message
          : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
