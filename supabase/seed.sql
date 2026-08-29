-- Seed default categories for a household
-- Run AFTER a user has signed up (so a household exists)
-- Replace 'YOUR_HOUSEHOLD_ID' with the actual household UUID

-- Example: Get your household_id first:
-- select household_id from profiles where email = 'your@email.com';

do $$
declare
  hid uuid;
  housing_id uuid;
  food_id uuid;
  medical_id uuid;
  transport_id uuid;
  clothing_id uuid;
  recreation_id uuid;
  misc_id uuid;
begin
  -- Get the first household (or set manually)
  select id into hid from public.households limit 1;

  if hid is null then
    raise exception 'No household found. Sign up first.';
  end if;

  -- Income
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values
    (hid, 'Income', 'income', 'income', true, 1),
    (hid, 'Alina Net Income', 'alina-net-income', 'income', true, 2),
    (hid, 'Jeff Net Income', 'jeff-net-income', 'income', true, 3),
    (hid, 'Other Income', 'other-income', 'income', true, 4);

  -- Housing (parent)
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Housing', 'housing', 'expense', true, 10)
  returning id into housing_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, housing_id, 'Mortgage', 'mortgage', 'expense', true, 11),
    (hid, housing_id, 'Property Taxes', 'property-taxes', 'expense', true, 12),
    (hid, housing_id, 'Homeowners Insurance', 'homeowners-insurance', 'expense', true, 13),
    (hid, housing_id, 'Electric', 'electric', 'expense', true, 14),
    (hid, housing_id, 'Gas', 'gas-utility', 'expense', true, 15),
    (hid, housing_id, 'Internet', 'internet', 'expense', true, 16),
    (hid, housing_id, 'Cable TV', 'cable-tv', 'expense', true, 17),
    (hid, housing_id, 'Cell Phone', 'cell-phone', 'expense', true, 18),
    (hid, housing_id, 'Trash', 'trash', 'expense', true, 19),
    (hid, housing_id, 'Landscaping', 'landscaping', 'expense', true, 20),
    (hid, housing_id, 'Home Maintenance', 'home-maintenance', 'expense', true, 21),
    (hid, housing_id, 'Home Improvements', 'home-improvements', 'expense', true, 22),
    (hid, housing_id, 'Furniture and Decor', 'furniture-decor', 'expense', true, 23),
    (hid, housing_id, 'Domestic Help', 'domestic-help', 'expense', true, 24),
    (hid, housing_id, 'IRS', 'irs', 'expense', true, 25),
    (hid, housing_id, 'Ventanas de Impacto', 'ventanas-de-impacto', 'expense', true, 26);

  -- Food (parent)
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Food', 'food', 'expense', true, 30)
  returning id into food_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, food_id, 'Groceries', 'groceries', 'expense', true, 31),
    (hid, food_id, 'Dining Out', 'dining-out', 'expense', true, 32);

  -- Medical (parent)
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Medical', 'medical', 'expense', true, 40)
  returning id into medical_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, medical_id, 'Health Insurance Premium', 'health-insurance', 'expense', true, 41),
    (hid, medical_id, 'Prescription Drugs', 'prescriptions', 'expense', true, 42),
    (hid, medical_id, 'Doctor Office Visits', 'doctor-visits', 'expense', true, 43),
    (hid, medical_id, 'Dentist', 'dentist', 'expense', true, 44),
    (hid, medical_id, 'Optician / Glasses', 'optician', 'expense', true, 45);

  -- Transportation (parent)
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Transportation', 'transportation', 'expense', true, 50)
  returning id into transport_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, transport_id, 'Auto Lease 1', 'auto-lease-1', 'expense', true, 51),
    (hid, transport_id, 'Auto Lease 2', 'auto-lease-2', 'expense', true, 52),
    (hid, transport_id, 'Gas / Oil', 'gas-oil', 'expense', true, 53),
    (hid, transport_id, 'Parking / Tolls', 'parking-tolls', 'expense', true, 54);

  -- Clothing / Personal Care
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Clothing / Personal Care', 'clothing-personal', 'expense', true, 60)
  returning id into clothing_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, clothing_id, 'Clothing', 'clothing', 'expense', true, 61),
    (hid, clothing_id, 'Toiletries / Makeup / Haircuts', 'toiletries', 'expense', true, 62);

  -- Recreation
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Recreation', 'recreation', 'expense', true, 70)
  returning id into recreation_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, recreation_id, 'Vacation / Travel', 'vacation-travel', 'expense', true, 71),
    (hid, recreation_id, 'Movies', 'movies', 'expense', true, 72),
    (hid, recreation_id, 'Concerts', 'concerts', 'expense', true, 73),
    (hid, recreation_id, 'Theater / Opera', 'theater-opera', 'expense', true, 74);

  -- Miscellaneous
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Miscellaneous', 'miscellaneous', 'expense', true, 80)
  returning id into misc_id;

  insert into public.categories (household_id, parent_id, name, slug, type, is_system, sort_order)
  values
    (hid, misc_id, 'Pet Care', 'pet-care', 'expense', true, 81),
    (hid, misc_id, 'Charitable Contributions', 'charity', 'expense', true, 82),
    (hid, misc_id, 'Gifts', 'gifts', 'expense', true, 83);

  -- Transfer
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Transfer', 'transfer', 'transfer', true, 90);

  -- Uncategorized
  insert into public.categories (household_id, name, slug, type, is_system, sort_order)
  values (hid, 'Uncategorized', 'uncategorized', 'expense', true, 99);

end $$;
