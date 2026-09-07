-- Plaid Item connections (one per linked institution)

create table public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plaid_item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  cursor text, -- transactions sync cursor
  status text not null default 'active' check (status in ('active', 'error', 'revoked')),
  error_code text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plaid_items_household_id_idx on public.plaid_items (household_id);

create trigger plaid_items_updated_at
  before update on public.plaid_items
  for each row execute function public.set_updated_at();

alter table public.plaid_items enable row level security;

-- Members can see their items but access_token should only be used server-side.
-- Client should select without access_token when listing.
create policy "Members can view plaid_items"
  on public.plaid_items for select
  using (household_id = public.user_household_id());

create policy "Members can insert plaid_items"
  on public.plaid_items for insert
  with check (household_id = public.user_household_id());

create policy "Members can update plaid_items"
  on public.plaid_items for update
  using (household_id = public.user_household_id());

create policy "Members can delete plaid_items"
  on public.plaid_items for delete
  using (household_id = public.user_household_id());

-- Flag on accounts for user exclusion after Link
alter table public.accounts
  add column if not exists is_selected boolean not null default true;
