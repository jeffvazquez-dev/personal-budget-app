"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Account } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";

interface Props {
  categories: Category[];
  accounts: Account[];
  householdId: string;
}

interface ParsedRow {
  date: string;
  amount: number;
  type: "income" | "expense";
  merchant: string;
  description: string;
  categoryName: string;
  categoryId: string | null;
  raw: Record<string, string>;
}

type ColumnKey = "date" | "amount" | "merchant" | "description" | "category" | "type" | "skip";

const COLUMN_OPTIONS: { value: ColumnKey; label: string }[] = [
  { value: "skip", label: "— Skip —" },
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "merchant", label: "Merchant / Payee" },
  { value: "description", label: "Description / Notes" },
  { value: "category", label: "Category" },
  { value: "type", label: "Type (income/expense)" },
];

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/^\uFEFF/, "") // strip BOM
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? "").replace(/^"|"$/g, "");
    });
    return obj;
  });

  return { headers, rows };
}

function guessMapping(headers: string[]): Record<string, ColumnKey> {
  const map: Record<string, ColumnKey> = {};
  for (const h of headers) {
    const lower = h.toLowerCase();
    if (/date|fecha/.test(lower)) map[h] = "date";
    else if (/amount|monto|value|importe|total/.test(lower)) map[h] = "amount";
    else if (/merchant|payee|vendor|comercio|descripci[oó]n|description|memo|note/.test(lower))
      map[h] = /merchant|payee|vendor|comercio/.test(lower) ? "merchant" : "description";
    else if (/categor/.test(lower)) map[h] = "category";
    else if (/type|tipo|income|expense|ingreso|gasto/.test(lower)) map[h] = "type";
    else map[h] = "skip";
  }
  return map;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // MM/DD/YYYY or M/D/YYYY
  const us = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    const month = us[1].padStart(2, "0");
    const day = us[2].padStart(2, "0");
    let year = us[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }
  // DD/MM/YYYY
  const eu = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (eu) {
    // Ambiguous — prefer US style already handled; treat as D/M/Y if day > 12
    const d = parseInt(eu[1], 10);
    const m = parseInt(eu[2], 10);
    if (d > 12) {
      return `${eu[3]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  // Remove currency symbols, spaces, parentheses for negatives
  let cleaned = raw.replace(/[$€£,\s]/g, "").trim();
  const neg = /^\(.*\)$/.test(cleaned) || cleaned.startsWith("-");
  cleaned = cleaned.replace(/[()\-]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return neg ? -Math.abs(num) : num;
}

function matchCategory(
  name: string,
  categories: Category[]
): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  // Exact match
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.id;
  // Slug-ish match
  const slug = lower.replace(/[^a-z0-9]+/g, "-");
  const bySlug = categories.find((c) => c.slug === slug);
  if (bySlug) return bySlug.id;
  // Contains
  const partial = categories.find(
    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  return partial?.id ?? null;
}

export function ImportForm({ categories, accounts, householdId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColumnKey>>({});
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const text = await file.text();
    const { headers: h, rows } = parseCSV(text);
    if (h.length === 0 || rows.length === 0) {
      setError("Could not parse CSV. Make sure it has a header row and data.");
      return;
    }
    setHeaders(h);
    setRawRows(rows);
    setMapping(guessMapping(h));
    setStep("map");
  }, []);

  function buildParsed(): ParsedRow[] {
    const dateCol = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
    const amountCol = Object.entries(mapping).find(([, v]) => v === "amount")?.[0];
    const merchantCol = Object.entries(mapping).find(([, v]) => v === "merchant")?.[0];
    const descCol = Object.entries(mapping).find(([, v]) => v === "description")?.[0];
    const catCol = Object.entries(mapping).find(([, v]) => v === "category")?.[0];
    const typeCol = Object.entries(mapping).find(([, v]) => v === "type")?.[0];

    if (!dateCol || !amountCol) {
      setError("You must map at least Date and Amount columns.");
      return [];
    }

    const result: ParsedRow[] = [];

    for (const row of rawRows) {
      const date = parseDate(row[dateCol] ?? "");
      const amountRaw = parseAmount(row[amountCol] ?? "");
      if (!date || amountRaw === null || amountRaw === 0) continue;

      let type: "income" | "expense" = amountRaw > 0 ? "income" : "expense";
      if (typeCol && row[typeCol]) {
        const t = row[typeCol].toLowerCase();
        if (/income|ingreso|credit/.test(t)) type = "income";
        else if (/expense|gasto|debit/.test(t)) type = "expense";
      }

      const catName = catCol ? row[catCol] ?? "" : "";
      const categoryId = matchCategory(catName, categories);

      result.push({
        date,
        amount: Math.abs(amountRaw),
        type,
        merchant: merchantCol ? row[merchantCol] ?? "" : "",
        description: descCol ? row[descCol] ?? "" : "",
        categoryName: catName,
        categoryId,
        raw: row,
      });
    }

    return result;
  }

  function goToPreview() {
    setError(null);
    const rows = buildParsed();
    if (rows.length === 0) {
      setError("No valid rows found. Check your Date and Amount mapping.");
      return;
    }
    setParsed(rows);
    setStep("preview");
  }

  async function handleImport() {
    if (!accountId) {
      setError("Select an account");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const batch = parsed.map((row) => ({
      household_id: householdId,
      account_id: accountId,
      category_id: row.categoryId,
      amount: row.type === "expense" ? -row.amount : row.amount,
      type: row.type,
      date: row.date,
      merchant_name: row.merchant || null,
      description: row.description || null,
    }));

    // Insert in chunks of 50
    let inserted = 0;
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const { error: insertError } = await supabase.from("transactions").insert(chunk);
      if (insertError) {
        setError(`Error on row ${i + 1}: ${insertError.message}`);
        setLoading(false);
        return;
      }
      inserted += chunk.length;
    }

    setLoading(false);
    setImportResult(`Successfully imported ${inserted} transactions.`);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  // ---- UPLOAD STEP ----
  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div
          className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center hover:border-blue-400 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Drag & drop a CSV file here, or click to browse
          </p>
          <label className="inline-block cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
            Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p className="font-medium text-gray-800 dark:text-gray-200">How to export from Excel</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open your budget spreadsheet</li>
            <li>Select the sheet with transactions (or create a flat list: Date, Amount, Category, Merchant)</li>
            <li>File → Save As → CSV UTF-8</li>
            <li>Upload that file here</li>
          </ol>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ---- MAP STEP ----
  if (step === "map") {
    return (
      <div className="space-y-6">
        <p className="text-sm text-gray-500">
          Matched <strong>{rawRows.length}</strong> rows. Map your CSV columns:
        </p>

        <div className="space-y-3">
          {headers.map((h) => (
            <div key={h} className="flex items-center gap-3">
              <span className="w-40 text-sm font-medium truncate" title={h}>
                {h}
              </span>
              <span className="text-gray-400">→</span>
              <select
                value={mapping[h] ?? "skip"}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [h]: e.target.value as ColumnKey }))
                }
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-sm"
              >
                {COLUMN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Import into account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={goToPreview}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            Preview import
          </button>
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="rounded-lg border border-gray-300 dark:border-gray-700 text-sm px-4 py-2"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ---- PREVIEW STEP ----
  return (
    <div className="space-y-6">
      {importResult ? (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3">
          {importResult}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Ready to import <strong>{parsed.length}</strong> transactions into{" "}
            <strong>{accounts.find((a) => a.id === accountId)?.name}</strong>
          </p>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Merchant</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-1.5">{row.date}</td>
                    <td className="px-3 py-1.5 truncate max-w-[140px]">
                      {row.merchant || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">
                      {row.categoryId
                        ? categories.find((c) => c.id === row.categoryId)?.name
                        : row.categoryName || "Uncategorized"}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        row.type === "income"
                          ? "text-green-600"
                          : ""
                      }`}
                    >
                      {row.type === "income" ? "+" : "−"}
                      {formatMoney(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 50 && (
              <p className="text-xs text-gray-400 px-3 py-2">
                Showing first 50 of {parsed.length} rows
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={loading}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
            >
              {loading ? "Importing..." : `Import ${parsed.length} transactions`}
            </button>
            <button
              type="button"
              onClick={() => setStep("map")}
              className="rounded-lg border border-gray-300 dark:border-gray-700 text-sm px-4 py-2"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
