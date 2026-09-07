"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, CategoryType } from "@/lib/types";

interface Props {
  initialCategories: Category[];
  householdId: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function CategoriesManager({
  initialCategories,
  householdId,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("expense");
  const [newParentId, setNewParentId] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const visible = useMemo(() => {
    return categories.filter((c) =>
      showArchived ? true : !c.is_archived
    );
  }, [categories, showArchived]);

  const tree = useMemo(() => {
    const parents = visible.filter((c) => !c.parent_id);
    const children = visible.filter((c) => c.parent_id);
    const rows: { cat: Category; depth: number }[] = [];

    // Group by type for readability
    const types: CategoryType[] = ["income", "expense", "transfer"];
    for (const type of types) {
      const typeParents = parents
        .filter((p) => p.type === type)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const p of typeParents) {
        rows.push({ cat: p, depth: 0 });
        const kids = children
          .filter((c) => c.parent_id === p.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        for (const k of kids) {
          rows.push({ cat: k, depth: 1 });
        }
      }
      // Orphan children of this type
      const parentIds = new Set(typeParents.map((p) => p.id));
      for (const c of children.filter((x) => x.type === type)) {
        if (!parentIds.has(c.parent_id!)) {
          rows.push({ cat: c, depth: 0 });
        }
      }
    }
    return rows;
  }, [visible]);

  const parentOptions = useMemo(() => {
    return categories.filter(
      (c) =>
        !c.is_archived &&
        !c.parent_id &&
        c.type === newType &&
        c.slug !== "uncategorized"
    );
  }, [categories, newType]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    let slug = slugify(name);
    if (!slug) slug = `cat-${Date.now()}`;

    // Ensure unique slug
    const existing = categories.find((c) => c.slug === slug);
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));

    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        name,
        slug,
        type: newType,
        parent_id: newParentId || null,
        is_system: false,
        is_archived: false,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    setBusy(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data) {
      setCategories((prev) => [...prev, data]);
      setNewName("");
      setNewParentId("");
      router.refresh();
    }
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c))
    );
    setEditingId(null);
    router.refresh();
  }

  async function toggleArchive(cat: Category) {
    setBusy(true);
    setError(null);
    const next = !cat.is_archived;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ is_archived: next })
      .eq("id", cat.id);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_archived: next } : c))
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Create */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold">Add category</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            required
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value as CategoryType);
              setNewParentId("");
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <select
            value={newParentId}
            onChange={(e) => setNewParentId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">No parent (top level)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                Under: {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            Add
          </button>
        </div>
      </form>

      {/* List controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your categories</h2>
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {tree.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">
            No categories yet. Run the seed SQL or add one above.
          </p>
        ) : (
          tree.map(({ cat, depth }) => (
            <div
              key={cat.id}
              className={`flex items-center gap-2 px-4 py-2.5 ${
                cat.is_archived ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0" style={{ paddingLeft: depth * 16 }}>
                {editingId === cat.id ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename(cat.id);
                    }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="text-xs text-blue-600 font-medium"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {cat.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      {cat.type}
                    </span>
                    {cat.is_system && (
                      <span className="text-[10px] text-gray-400">system</span>
                    )}
                    {cat.is_archived && (
                      <span className="text-[10px] text-amber-600">archived</span>
                    )}
                  </div>
                )}
              </div>

              {editingId !== cat.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 px-1.5 py-1"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleArchive(cat)}
                    className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-1.5 py-1"
                  >
                    {cat.is_archived ? "Restore" : "Archive"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-gray-400">
        Archive hides a category from pickers without deleting history.
        System categories can still be renamed or archived if you prefer.
      </p>
    </div>
  );
}
