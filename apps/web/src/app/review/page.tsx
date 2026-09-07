import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data";
import { CONFIDENCE_THRESHOLD } from "@/lib/categorization";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const categories = await getCategories();

  const { data: txs } = await supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .or(`category_id.is.null,confidence.lt.${CONFIDENCE_THRESHOLD},confidence.is.null`)
    .order("date", { ascending: false })
    .limit(100);

  const items = txs ?? [];

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Needs review</h1>
            <p className="text-sm text-gray-500 mt-1">
              Low-confidence or uncategorized transactions (threshold{" "}
              {Math.round(CONFIDENCE_THRESHOLD * 100)}%)
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Dashboard
          </Link>
        </div>

        <ReviewClient
          initialItems={items}
          categories={categories}
          threshold={CONFIDENCE_THRESHOLD}
        />
      </div>
    </main>
  );
}
