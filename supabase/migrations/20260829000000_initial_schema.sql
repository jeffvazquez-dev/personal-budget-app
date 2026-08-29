-- Initial schema for Personal Budget App
-- Run this in the Supabase SQL Editor (or via CLI)

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ACCOUNTS (bank accounts, credit cards, cash, etc.)
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'cash', 'investment', 'other')),
  currency text not null default 'USD',
  plaid_account_id text,
  plaid_item_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_household_id_idx on public.accounts (household_id);

-- ============================================================
-- CATEGORIES (hierarchical)
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  icon text,
  color text,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, slug)
);

create index categories_household_id_idx on public.categories (household_id);
create index categories_parent_id_idx on public.categories (parent_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12, 2) not null,
  -- positive = inflow (income), negative = outflow (expense)
  description text,
  merchant_name text,
  notes text,
  date date not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  transfer_pair_id uuid, -- links the two sides of a transfer
  plaid_transaction_id text,
  is_pending boolean not null default false,
  is_recurring boolean not null default false,
  confidence numeric(3, 2), -- AI confidence 0.00–1.00
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz -- soft delete
);

create index transactions_household_id_idx on public.transactions (household_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_date_idx on public.transactions (date desc);
create index transactions_plaid_id_idx on public.transactions (plaid_transaction_id);

-- ============================================================
-- BUDGETS (monthly targets per category)
-- ============================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null,
  month date not null, -- first day of the month
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, month)
);

create index budgets_household_id_idx on public.budgets (household_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE + HOUSEHOLD ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_household_id uuid;
begin
  -- Create a default household for the new user
  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Household')
  returning id into new_household_id;

  -- Create profile linked to household
  insert into public.profiles (id, household_id, full_name, email)
  values (
    new.id,
    new_household_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Helper: get current user's household_id
create or replace function public.user_household_id()
returns uuid as $$
  select household_id from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Households: members can view their household
create policy "Members can view household"
  on public.households for select
  using (id = public.user_household_id());

create policy "Members can update household"
  on public.households for update
  using (id = public.user_household_id());

-- Accounts
create policy "Members can view accounts"
  on public.accounts for select
  using (household_id = public.user_household_id());

create policy "Members can insert accounts"
  on public.accounts for insert
  with check (household_id = public.user_household_id());

create policy "Members can update accounts"
  on public.accounts for update
  using (household_id = public.user_household_id());

create policy "Members can delete accounts"
  on public.accounts for delete
  using (household_id = public.user_household_id());

-- Categories
create policy "Members can view categories"
  on public.categories for select
  using (household_id = public.user_household_id());

create policy "Members can insert categories"
  on public.categories for insert
  with check (household_id = public.user_household_id());

create policy "Members can update categories"
  on public.categories for update
  using (household_id = public.user_household_id());

create policy "Members can delete categories"
  on public.categories for delete
  using (household_id = public.user_household_id());

-- Transactions
create policy "Members can view transactions"
  on public.transactions for select
  using (household_id = public.user_household_id());

create policy "Members can insert transactions"
  on public.transactions for insert
  with check (household_id = public.user_household_id());

create policy "Members can update transactions"
  on public.transactions for update
  using (household_id = public.user_household_id());

create policy "Members can delete transactions"
  on public.transactions for delete
  using (household_id = public.user_household_id());

-- Budgets
create policy "Members can view budgets"
  on public.budgets for select
  using (household_id = public.user_household_id());

create policy "Members can insert budgets"
  on public.budgets for insert
  with check (household_id = public.user_household_id());

create policy "Members can update budgets"
  on public.budgets for update
  using (household_id = public.user_household_id());

create policy "Members can delete budgets"
  on public.budgets for delete
  using (household_id = public.user_household_id());
