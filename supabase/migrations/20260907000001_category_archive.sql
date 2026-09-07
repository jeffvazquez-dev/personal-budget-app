-- Soft-archive categories instead of hard delete (keeps history on transactions)

alter table public.categories
  add column if not exists is_archived boolean not null default false;

create index if not exists categories_archived_idx
  on public.categories (household_id, is_archived);
