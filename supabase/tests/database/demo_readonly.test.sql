-- Restrictions démo testées avec les rôles/JWT réels de PostgREST.
begin;
select plan(84);
insert into auth.users (id, email, encrypted_password) values
 ('dddddddd-0000-0000-0000-000000000001', 'demo-readonly@test.local', crypt('throwaway-demo-test-only', gen_salt('bf'))),
 ('eeeeeeee-0000-0000-0000-000000000002', 'normal-readonly@test.local', null);
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);
select set_config('t.demo_space', public.personal_space_id(auth.uid())::text, true);
select set_config('t.shared', public.create_shared_space('Demo shared fixture')::text, true);
insert into public.space_members (space_id,user_id) values (current_setting('t.shared')::uuid, 'eeeeeeee-0000-0000-0000-000000000002');
insert into public.accounts (id,space_id,user_id,name,type) values
 ('d1000000-0000-0000-0000-000000000001',current_setting('t.demo_space')::uuid,auth.uid(),'Fixture','courant');
insert into public.accounts (space_id,user_id,name,type)
 values (public.personal_space_id('eeeeeeee-0000-0000-0000-000000000002'),'eeeeeeee-0000-0000-0000-000000000002','Private','courant');
insert into public.transactions (id,space_id,user_id,account_id,kind,amount_cents) values
 ('d2000000-0000-0000-0000-000000000001',current_setting('t.demo_space')::uuid,auth.uid(),'d1000000-0000-0000-0000-000000000001','expense',-1000);
insert into public.budgets (space_id,user_id,category_id,month,amount_cents)
 select current_setting('t.demo_space')::uuid,auth.uid(),id,date '2026-10-01',10000 from public.categories where space_id=current_setting('t.demo_space')::uuid and translation_key='alimentation';
insert into public.csv_import_rules (space_id,user_id,keyword,kind) values (current_setting('t.demo_space')::uuid,auth.uid(),'Fixture','expense');
insert into public.fixed_charges (space_id,user_id,name,amount_cents,frequency,next_due_date) values (current_setting('t.demo_space')::uuid,auth.uid(),'Fixture',1000,'monthly',date '2026-11-01');
insert into public.savings_goals (space_id,user_id,name,target_amount_cents) values (current_setting('t.demo_space')::uuid,auth.uid(),'Fixture',10000);
insert into public.invitations (space_id,inviter_user_id,invitee_email,token) values (current_setting('t.shared')::uuid,auth.uid(),'fixture@example.invalid','demo-readonly-invite');
insert into public.shared_expenses (space_id,source_transaction_id,paid_by,shares) values
 (current_setting('t.shared')::uuid,'d2000000-0000-0000-0000-000000000001',auth.uid(),jsonb_build_object(auth.uid()::text,100));
insert into public.settlements (space_id,from_user,to_user,amount_cents,created_by) values
 (current_setting('t.shared')::uuid,auth.uid(),'eeeeeeee-0000-0000-0000-000000000002',100,auth.uid());
insert into public.demo_users values (auth.uid());

-- Le catalogue détecte aussi une future table oubliée par la migration.
select is((select count(*)::int from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name <> 'demo_users'),13,'all business tables inventoried');
select is((select count(*)::int from pg_policies where schemaname='public' and policyname like 'demo_readonly_%' and permissive='RESTRICTIVE'),39,'three restrictive policies per business table');
select is((select count(*)::int from pg_policies where schemaname='public' and tablename='demo_users'),0,'demo registry has no policies');
set local role authenticated;
select is(public.is_demo_user(),true,'demo is identified');
select throws_ok($$select * from public.demo_users$$,'42501',null,'registry cannot be read');
select throws_ok($$delete from public.demo_users$$,'42501',null,'demo cannot remove its restriction');

select ok((select count(*) > 0 from public.accounts),'demo can read accounts');
select throws_ok($$insert into public.accounts select * from public.accounts limit 1$$,'42501',null,'demo cannot insert accounts');
with changed as (update public.accounts set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update accounts (RLS filters rows)');
with changed as (delete from public.accounts returning 1) select is((select count(*)::int from changed),0,'demo cannot delete accounts (RLS filters rows)');

select ok((select count(*) > 0 from public.budgets),'demo can read budgets');
select throws_ok($$insert into public.budgets select * from public.budgets limit 1$$,'42501',null,'demo cannot insert budgets');
with changed as (update public.budgets set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update budgets (RLS filters rows)');
with changed as (delete from public.budgets returning 1) select is((select count(*)::int from changed),0,'demo cannot delete budgets (RLS filters rows)');

select ok((select count(*) > 0 from public.categories),'demo can read categories');
select throws_ok($$insert into public.categories select * from public.categories limit 1$$,'42501',null,'demo cannot insert categories');
with changed as (update public.categories set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update categories (RLS filters rows)');
with changed as (delete from public.categories returning 1) select is((select count(*)::int from changed),0,'demo cannot delete categories (RLS filters rows)');

select ok((select count(*) > 0 from public.csv_import_rules),'demo can read csv_import_rules');
select throws_ok($$insert into public.csv_import_rules select * from public.csv_import_rules limit 1$$,'42501',null,'demo cannot insert csv_import_rules');
with changed as (update public.csv_import_rules set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update csv_import_rules (RLS filters rows)');
with changed as (delete from public.csv_import_rules returning 1) select is((select count(*)::int from changed),0,'demo cannot delete csv_import_rules (RLS filters rows)');

select ok((select count(*) > 0 from public.fixed_charges),'demo can read fixed_charges');
select throws_ok($$insert into public.fixed_charges select * from public.fixed_charges limit 1$$,'42501',null,'demo cannot insert fixed_charges');
with changed as (update public.fixed_charges set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update fixed_charges (RLS filters rows)');
with changed as (delete from public.fixed_charges returning 1) select is((select count(*)::int from changed),0,'demo cannot delete fixed_charges (RLS filters rows)');

select ok((select count(*) > 0 from public.invitations),'demo can read invitations');
select throws_ok($$insert into public.invitations select * from public.invitations limit 1$$,'42501',null,'demo cannot insert invitations');
with changed as (update public.invitations set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update invitations (RLS filters rows)');
with changed as (delete from public.invitations returning 1) select is((select count(*)::int from changed),0,'demo cannot delete invitations (RLS filters rows)');

select ok((select count(*) > 0 from public.profiles),'demo can read profiles');
select throws_ok($$insert into public.profiles select * from public.profiles limit 1$$,'42501',null,'demo cannot insert profiles');
with changed as (update public.profiles set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update profiles (RLS filters rows)');
with changed as (delete from public.profiles returning 1) select is((select count(*)::int from changed),0,'demo cannot delete profiles (RLS filters rows)');

select ok((select count(*) > 0 from public.savings_goals),'demo can read savings_goals');
select throws_ok($$insert into public.savings_goals select * from public.savings_goals limit 1$$,'42501',null,'demo cannot insert savings_goals');
with changed as (update public.savings_goals set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update savings_goals (RLS filters rows)');
with changed as (delete from public.savings_goals returning 1) select is((select count(*)::int from changed),0,'demo cannot delete savings_goals (RLS filters rows)');

select ok((select count(*) > 0 from public.settlements),'demo can read settlements');
select throws_ok($$insert into public.settlements select * from public.settlements limit 1$$,'42501',null,'demo cannot insert settlements');
select throws_ok($$update public.settlements set id=id$$,'42501',null,'settlements update privilege remains revoked');
with changed as (delete from public.settlements returning 1) select is((select count(*)::int from changed),0,'demo cannot delete settlements (RLS filters rows)');

select ok((select count(*) > 0 from public.shared_expenses),'demo can read shared_expenses');
select throws_ok($$insert into public.shared_expenses select * from public.shared_expenses limit 1$$,'42501',null,'demo cannot insert shared_expenses');
with changed as (update public.shared_expenses set shares=shares returning 1) select is((select count(*)::int from changed),0,'demo cannot update shared_expenses (RLS filters rows)');
with changed as (delete from public.shared_expenses returning 1) select is((select count(*)::int from changed),0,'demo cannot delete shared_expenses (RLS filters rows)');

select ok((select count(*) > 0 from public.space_members),'demo can read space_members');
select throws_ok($$insert into public.space_members select * from public.space_members limit 1$$,'42501',null,'demo cannot insert space_members');
with changed as (update public.space_members set space_id=space_id returning 1) select is((select count(*)::int from changed),0,'demo cannot update space_members (RLS filters rows)');
with changed as (delete from public.space_members returning 1) select is((select count(*)::int from changed),0,'demo cannot delete space_members (RLS filters rows)');

select ok((select count(*) > 0 from public.spaces),'demo can read spaces');
select throws_ok($$insert into public.spaces select * from public.spaces limit 1$$,'42501',null,'demo cannot insert spaces');
with changed as (update public.spaces set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update spaces (RLS filters rows)');
with changed as (delete from public.spaces returning 1) select is((select count(*)::int from changed),0,'demo cannot delete spaces (RLS filters rows)');

select ok((select count(*) > 0 from public.transactions),'demo can read transactions');
select throws_ok($$insert into public.transactions select * from public.transactions limit 1$$,'42501',null,'demo cannot insert transactions');
with changed as (update public.transactions set id=id returning 1) select is((select count(*)::int from changed),0,'demo cannot update transactions (RLS filters rows)');
with changed as (delete from public.transactions returning 1) select is((select count(*)::int from changed),0,'demo cannot delete transactions (RLS filters rows)');

select is((select count(*)::int from public.accounts where user_id='eeeeeeee-0000-0000-0000-000000000002'),0,'demo cannot read private accounts of another user');
select is((select count(*)::int from public.categories where space_id not in (current_setting('t.demo_space')::uuid,current_setting('t.shared')::uuid)),0,'demo cannot read private categories of another user');
select throws_ok($$select public.create_shared_space('Denied')$$,'42501','demo account is read-only','demo write RPC create_shared_space denied');
select throws_ok($$select public.accept_space_invitation('demo-readonly-invite')$$,'42501','demo account is read-only','demo write RPC accept_space_invitation denied');
select throws_ok($$select public.import_transactions('[]'::jsonb)$$,'42501','demo account is read-only','demo write RPC import_transactions denied');
select throws_ok($$select public.share_transactions('[]'::jsonb)$$,'42501','demo account is read-only','demo write RPC share_transactions denied');
select throws_ok($$select public.convert_transaction('d2000000-0000-0000-0000-000000000001',current_setting('t.demo_space')::uuid,'income','d1000000-0000-0000-0000-000000000001',100,date '2026-10-01','Denied',null,null)$$,'42501','demo account is read-only','demo write RPC convert_transaction denied');

select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.is_demo_user(),false,'normal user is not demo');
select lives_ok($$insert into public.accounts (space_id,user_id,name,type) select id,auth.uid(),'Normal write','courant' from public.spaces where kind='personal'$$,'normal user still inserts');
with changed as (update public.accounts set name='Normal update' where name='Normal write' returning 1) select is((select count(*)::int from changed),1,'normal user still updates');
with changed as (delete from public.accounts where name='Normal update' returning 1) select is((select count(*)::int from changed),1,'normal user still deletes');
select lives_ok($$select public.create_shared_space('Normal RPC')$$,'normal definer RPC still works');
select lives_ok($$select public.import_transactions('[]'::jsonb)$$,'normal invoker RPC still works');
reset role;
-- Fixtures remain unchanged, including tables whose DELETE has no permissive policy.
select ok((select count(*) > 0 from public.accounts),'fixture accounts survives denied writes');
select ok((select count(*) > 0 from public.budgets),'fixture budgets survives denied writes');
select ok((select count(*) > 0 from public.categories),'fixture categories survives denied writes');
select ok((select count(*) > 0 from public.csv_import_rules),'fixture csv_import_rules survives denied writes');
select ok((select count(*) > 0 from public.fixed_charges),'fixture fixed_charges survives denied writes');
select ok((select count(*) > 0 from public.invitations),'fixture invitations survives denied writes');
select ok((select count(*) > 0 from public.profiles),'fixture profiles survives denied writes');
select ok((select count(*) > 0 from public.savings_goals),'fixture savings_goals survives denied writes');
select ok((select count(*) > 0 from public.settlements),'fixture settlements survives denied writes');
select ok((select count(*) > 0 from public.shared_expenses),'fixture shared_expenses survives denied writes');
select ok((select count(*) > 0 from public.space_members),'fixture space_members survives denied writes');
select ok((select count(*) > 0 from public.spaces),'fixture spaces survives denied writes');
select ok((select count(*) > 0 from public.transactions),'fixture transactions survives denied writes');
select * from finish();
rollback;
