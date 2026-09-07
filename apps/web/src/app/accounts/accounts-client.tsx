"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/types";

interface PlaidItemRow {
  id: string;
  plaid_item_id: string;
  institution_name: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface Props {
  initialAccounts: Account[];
  initialItems: PlaidItemRow[];
}

export function AccountsClient({ initialAccounts, initialItems }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [items, setItems] = useState(initialItems);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Exchange failed");
        } else {
          setMessage(
            data.message ||
              `Connected ${data.accounts?.length ?? 0} account(s)`
          );
          router.refresh();
          window.location.reload();
        }
      } catch {
        setError("Network error during token exchange");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setBusy(false),
  });

  async function startLink() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create link token");
        setBusy(false);
        return;
      }
      setLinkToken(data.link_token);
      // open after token is set — usePlaidLink needs a re-render
      setTimeout(() => open(), 100);
    } catch {
      setError("Network error creating link token");
      setBusy(false);
    }
  }

  // When linkToken arrives and ready, allow open via button
  async function connectBank() {
    if (linkToken && ready) {
      open();
      return;
    }
    await startLink();
  }

  async function toggleSelected(account: Account) {
    const next = !(account as Account & { is_selected?: boolean }).is_selected;
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("accounts")
      .update({ is_selected: next })
      .eq("id", account.id);

    if (updError) {
      setError(updError.message);
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === account.id
          ? ({ ...a, is_selected: next } as Account & { is_selected: boolean })
          : a
      )
    );
  }

  async function syncTransactions() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
      } else {
        setMessage(data.message);
        router.refresh();
      }
    } catch {
      setError("Network error during sync");
    } finally {
      setBusy(false);
    }
  }

  const plaidAccounts = accounts.filter((a) => a.plaid_account_id);
  const manualAccounts = accounts.filter((a) => !a.plaid_account_id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={connectBank}
          disabled={busy}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          {busy ? "Working…" : "Connect bank / card"}
        </button>
        <button
          type="button"
          onClick={syncTransactions}
          disabled={busy || items.length === 0}
          className="rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
        >
          Sync transactions
        </button>
      </div>

      {message && (
        <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
          {error}
        </p>
      )}

      {/* Linked institutions */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Linked institutions</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">
            None yet. Use Sandbox credentials in Plaid Link (e.g. user_good /
            pass_good).
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm"
              >
                <div className="font-medium">
                  {item.institution_name || "Institution"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Status: {item.status}
                  {item.last_synced_at && (
                    <> · Last sync {new Date(item.last_synced_at).toLocaleString()}</>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account selection */}
      <section>
        <h2 className="text-sm font-semibold mb-1">Plaid accounts</h2>
        <p className="text-xs text-gray-500 mb-3">
          Uncheck accounts you do not want to import. Only selected accounts are
          synced.
        </p>
        {plaidAccounts.length === 0 ? (
          <p className="text-sm text-gray-500">No Plaid accounts connected.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {plaidAccounts.map((a) => {
              const selected =
                (a as Account & { is_selected?: boolean }).is_selected !== false;
              return (
                <label
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(a)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.type} · {a.currency}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {manualAccounts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Manual accounts</h2>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {manualAccounts.map((a) => (
              <li key={a.id}>
                {a.name} ({a.type})
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-xs text-gray-500 space-y-2">
        <p className="font-medium text-gray-700 dark:text-gray-300">
          Sandbox test credentials
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Institution: any (e.g. First Platypus Bank)</li>
          <li>Username: <code className="text-xs">user_good</code></li>
          <li>Password: <code className="text-xs">pass_good</code></li>
        </ul>
        <p>
          After connecting, click <strong>Sync transactions</strong>, then open{" "}
          <a href="/review" className="text-blue-600">
            Review
          </a>{" "}
          to auto-categorize.
        </p>
      </div>
    </div>
  );
}
