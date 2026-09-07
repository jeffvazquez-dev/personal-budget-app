import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (client) return client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  client = new PlaidApi(configuration);
  return client;
}

export const PLAID_PRODUCTS = [Products.Transactions];
export const PLAID_COUNTRY_CODES = [CountryCode.Us];

export function mapPlaidAccountType(
  type: string | null | undefined,
  subtype: string | null | undefined
): "checking" | "savings" | "credit" | "cash" | "investment" | "other" {
  const t = (type || "").toLowerCase();
  const s = (subtype || "").toLowerCase();

  if (t === "credit" || s === "credit card") return "credit";
  if (t === "investment" || t === "brokerage") return "investment";
  if (s === "checking") return "checking";
  if (s === "savings" || s === "money market") return "savings";
  if (t === "depository") return s === "savings" ? "savings" : "checking";
  return "other";
}
