import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getCurrentProfile } from "@/lib/data";
import { CategoriesManager } from "./categories-manager";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profile, categories] = await Promise.all([
    getCurrentProfile(),
    getCategories({ includeArchived: true }),
  ]);

  if (!profile?.household_id) {
    return (
      <main className="min-h-screen p-8">
        <p>No household found. Please sign out and sign in again.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create, rename, nest, and archive categories for your household
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Dashboard
          </Link>
        </div>

        <CategoriesManager
          initialCategories={categories}
          householdId={profile.household_id}
        />
      </div>
    </main>
  );
}
