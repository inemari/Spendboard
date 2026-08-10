-- One-off seed for the Claude test account (claud3us3r@mail.com), so the
-- categorize screen has a realistic category set + uncategorized transactions
-- to test drag-and-drop against without needing a real statement upload.
-- Run in the Supabase SQL editor.
--
-- This is a full reset for this user (deletes their existing categories/
-- transactions/months first) rather than an additive insert — the previous
-- version of this script got run more than once and left duplicated
-- categories behind, since categories have no unique-name constraint the
-- way transactions do.
do $$
declare
  v_user_id uuid;
  v_month_id uuid;
  v_dagligvarer_husholdning_id uuid;
  v_helse_id uuid;
  v_fritid_id uuid;
begin
  select id into v_user_id from auth.users where email = 'claud3us3r@mail.com';
  if v_user_id is null then
    raise exception 'No auth user found for claud3us3r@mail.com';
  end if;

  delete from transactions where user_id = v_user_id;
  delete from categories where user_id = v_user_id;
  delete from months where user_id = v_user_id;

  insert into months (user_id, year, month) values (v_user_id, 2026, 8)
  returning id into v_month_id;

  -- 11 top-level categories; three carry 2-3 subcategories each.
  insert into categories (user_id, name, sort_order)
    values (v_user_id, 'Dagligvarer og husholdning', 0)
    returning id into v_dagligvarer_husholdning_id;
  insert into categories (user_id, name, parent_id, sort_order) values
    (v_user_id, 'Dagligvarer', v_dagligvarer_husholdning_id, 0),
    (v_user_id, 'Husholdning', v_dagligvarer_husholdning_id, 1);

  insert into categories (user_id, name, sort_order) values
    (v_user_id, 'Transport', 1),
    (v_user_id, 'Abbonementer', 2),
    (v_user_id, 'Chico', 3);

  insert into categories (user_id, name, sort_order)
    values (v_user_id, 'Helse', 4)
    returning id into v_helse_id;
  insert into categories (user_id, name, parent_id, sort_order) values
    (v_user_id, 'Apotek', v_helse_id, 0),
    (v_user_id, 'Trening', v_helse_id, 1),
    (v_user_id, 'Legesjekk', v_helse_id, 2);

  insert into categories (user_id, name, sort_order)
    values (v_user_id, 'Fritid/livsstil', 5)
    returning id into v_fritid_id;
  insert into categories (user_id, name, parent_id, sort_order) values
    (v_user_id, 'Spise/drikke ute', v_fritid_id, 0),
    (v_user_id, 'Alko', v_fritid_id, 1);

  insert into categories (user_id, name, sort_order) values
    (v_user_id, 'Hud/hårpleie', 6),
    (v_user_id, 'Snus', 7),
    (v_user_id, 'Tilbakebetaling', 8),
    (v_user_id, 'Other', 9);

  insert into transactions (user_id, month_id, date, description, location, amount, source_hash) values
    (v_user_id, v_month_id, '2026-08-01', 'Rema 1000', 'Kristiansand', -250.00, md5('t1')),
    (v_user_id, v_month_id, '2026-08-02', 'Circle K', 'Kristiansand', -90.00, md5('t2')),
    (v_user_id, v_month_id, '2026-08-03', 'Apotek 1', 'Kristiansand', -150.00, md5('t3')),
    (v_user_id, v_month_id, '2026-08-04', 'SATS Trening', 'Kristiansand', -399.00, md5('t4')),
    (v_user_id, v_month_id, '2026-08-05', 'H&M', 'Kristiansand', -499.00, md5('t5')),
    (v_user_id, v_month_id, '2026-08-06', 'Vinmonopolet', 'Kristiansand', -320.00, md5('t6')),
    (v_user_id, v_month_id, '2026-08-07', 'Peppes Pizza', 'Kristiansand', -280.00, md5('t7')),
    (v_user_id, v_month_id, '2026-08-08', 'Elkjøp', 'Kristiansand', -899.00, md5('t8')),
    (v_user_id, v_month_id, '2026-08-09', 'Vy Tog', 'Oslo', -450.00, md5('t9')),
    (v_user_id, v_month_id, '2026-08-10', 'Kolonial.no', 'Kristiansand', -620.00, md5('t10')),
    (v_user_id, v_month_id, '2026-08-11', 'Fysioterapi Sør', 'Kristiansand', -550.00, md5('t11')),
    (v_user_id, v_month_id, '2026-08-12', 'Netflix', 'Internet', -129.00, md5('t12'));
end $$;
