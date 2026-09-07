-- Merchant → category rules learned from user corrections

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  pattern text not null, -- normalized merchant substring match
  category_id uuid not null references public.categories (id) on delete cascade,
  source text not null default 'user' check (source in ('user', 'system')),
  hit_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, pattern)
);

create index category_rules_household_id_idx on public.category_rules (household_id);

create trigger category_rules_updated_at
  before update on public.category_rules
  for each row execute function public.set_updated_at();

alter table public.category_rules enable row level security;

create policy "Members can view category_rules"
  on public.category_rules for select
  using (household_id = public.user_household_id());

create policy "Members can insert category_rules"
  on public.category_rules for insert
  with check (household_id = public.user_household_id());

create policy "Members can update category_rules"
  on public.category_rules for update
  using (household_id = public.user_household_id());

create policy "Members can delete category_rules"
  on public.category_rules for delete
  using (household_id = public.user_household_id());

-- Index for needs-review queries (low confidence / uncategorized)
create index transactions_confidence_idx
  on public.transactions (household_id, confidence)
  where deleted_at is null;
