-- RLS / access tests for spaces. Run with: supabase test db
--
-- Three real users: A (creates a shared space), B (joins it), C (outsider).
-- Each check runs under the `authenticated` role with that user's JWT claims,
-- exactly like a PostgREST request.

begin;
select plan(40);

-- ---------------------------------------------------------------
-- Fixtures (as postgres). The sign-up trigger creates each profile,
-- personal space and default categories.
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.space_b', public.personal_space_id('bbbbbbbb-0000-0000-0000-00000000000b')::text, false);
select set_config('t.space_c', public.personal_space_id('cccccccc-0000-0000-0000-00000000000c')::text, false);

-- Sign-up provisioning ------------------------------------------------
select is(
  (select count(*)::int from public.spaces where kind = 'personal'
     and created_by in ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b')),
  2, 'sign-up creates one personal space per user');

select is(
  (select count(*)::int from public.categories where space_id = current_setting('t.space_a')::uuid),
  17, 'sign-up seeds the default categories in the personal space');

select is(
  (select role from public.space_members
    where space_id = current_setting('t.space_a')::uuid and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'owner', 'the user owns their personal space');

select throws_ok(
  $$insert into public.spaces (name, kind, created_by)
    values ('Second', 'personal', 'aaaaaaaa-0000-0000-0000-00000000000a')$$,
  '23505', null, 'a user cannot have two personal spaces');

-- ---------------------------------------------------------------
-- A works in their personal space
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.accounts (id, space_id, user_id, name, type)
    values ('a1000000-0000-0000-0000-000000000001', current_setting('t.space_a')::uuid,
            'aaaaaaaa-0000-0000-0000-00000000000a', 'A perso', 'courant')$$,
  'A can create an account in their own space');

select throws_ok(
  $$insert into public.accounts (space_id, user_id, name, type)
    values (current_setting('t.space_b')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Intrus', 'courant')$$,
  '42501', null, 'A cannot create an account in B''s space');

select throws_ok(
  $$insert into public.accounts (space_id, user_id, name, type)
    values (current_setting('t.space_a')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'Usurpe', 'courant')$$,
  '42501', null, 'A cannot author a row as somebody else');

select is(
  (select count(*)::int from public.categories where space_id = current_setting('t.space_b')::uuid),
  0, 'A cannot read B''s categories');

select is(
  (select count(*)::int from public.spaces), 1, 'A only sees their own space');

-- ---------------------------------------------------------------
-- A creates a shared space and invites B
-- ---------------------------------------------------------------
select lives_ok(
  $$select set_config('t.shared', public.create_shared_space('Foyer')::text, true)$$,
  'A can create a shared space');

select is(
  (select role from public.space_members
    where space_id = current_setting('t.shared')::uuid and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'owner', 'the creator owns the shared space');

select is(
  (select count(*)::int from public.categories where space_id = current_setting('t.shared')::uuid),
  17, 'a shared space gets its own default categories');

select lives_ok(
  $$insert into public.accounts (id, space_id, user_id, name, type)
    values ('a2000000-0000-0000-0000-000000000001', current_setting('t.shared')::uuid,
            'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte joint', 'courant')$$,
  'A can create an account in the shared space');

select lives_ok(
  $$insert into public.invitations (inviter_user_id, space_id, invitee_email, token)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', current_setting('t.shared')::uuid, 'b@test.local', 'tok-b')$$,
  'A can invite into the shared space');

select throws_ok(
  $$insert into public.invitations (inviter_user_id, space_id, invitee_email, token)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', current_setting('t.space_a')::uuid, 'x@test.local', 'tok-perso')$$,
  '42501', null, 'nobody can invite into a personal space');

select throws_ok(
  $$update public.invitations set space_id = current_setting('t.space_b')::uuid where token = 'tok-b'$$,
  '23514', null, 'an inviter cannot retarget an invitation to another space');

select throws_ok(
  $$update public.invitations set status = 'accepted' where token = 'tok-b'$$,
  '42501', null, 'an inviter cannot mark an invitation accepted by hand');

select throws_ok(
  $$update public.spaces set kind = 'shared' where id = current_setting('t.space_a')::uuid$$,
  '23514', null, 'a personal space cannot be turned into a shared one');

-- ---------------------------------------------------------------
-- Outsider C sees nothing
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.accounts where space_id = current_setting('t.shared')::uuid),
  0, 'C cannot read the shared space''s accounts');

select is(
  (select count(*)::int from public.invitations), 0, 'C cannot read invitations');

select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  0, 'C cannot read a profile they share no space with');

select throws_ok(
  $$select public.accept_space_invitation('does-not-exist')$$,
  'P0002', null, 'accepting an unknown token fails');

-- ---------------------------------------------------------------
-- Invitation flow: preview, accept, single use
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select space_name from public.get_space_invitation('tok-b')),
  'Foyer', 'an invitation can be previewed by its token');

select is(
  (select count(*)::int from public.accounts where space_id = current_setting('t.shared')::uuid),
  0, 'B sees nothing before accepting');

select is(
  public.accept_space_invitation('tok-b'),
  current_setting('t.shared')::uuid, 'B accepts the invitation');

select is(
  (select role from public.space_members
    where space_id = current_setting('t.shared')::uuid and user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'member', 'B joins as a plain member');

select throws_ok(
  $$select public.accept_space_invitation('tok-b')$$,
  '22023', null, 'an invitation is single use');

select is(
  (select count(*)::int from public.accounts where space_id = current_setting('t.shared')::uuid),
  1, 'B now sees the shared account');

select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  1, 'B can read the co-member''s profile');

select is(
  (select count(*)::int from public.accounts where space_id = current_setting('t.space_a')::uuid),
  0, 'B still cannot read A''s personal space');

select lives_ok(
  $$insert into public.transactions (space_id, user_id, account_id, kind, amount_cents)
    values (current_setting('t.shared')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b',
            'a2000000-0000-0000-0000-000000000001', 'expense', -1000)$$,
  'B can add a transaction to the shared account');

select throws_ok(
  $$update public.accounts set space_id = current_setting('t.space_b')::uuid
    where id = 'a2000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a row cannot be moved to another space');

select throws_ok(
  $$insert into public.transactions (space_id, user_id, account_id, kind, amount_cents)
    values (current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b',
            'a2000000-0000-0000-0000-000000000001', 'expense', -1)$$,
  '23514', null, 'a transaction cannot reference an account of another space');

-- ---------------------------------------------------------------
-- Owner-only operations. RLS filters rows silently, so each attempt is
-- followed by a check that nothing changed.
-- ---------------------------------------------------------------
update public.spaces set name = 'Renamed' where id = current_setting('t.shared')::uuid;
select is(
  (select name from public.spaces where id = current_setting('t.shared')::uuid),
  'Foyer', 'a plain member cannot rename the space');

delete from public.space_members
  where space_id = current_setting('t.shared')::uuid
    and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.space_members
    where space_id = current_setting('t.shared')::uuid
      and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  1, 'a member cannot remove the owner');

delete from public.spaces where id = current_setting('t.shared')::uuid;
select is(
  (select count(*)::int from public.spaces where id = current_setting('t.shared')::uuid),
  1, 'a member cannot delete the space');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

delete from public.space_members
  where space_id = current_setting('t.shared')::uuid
    and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.space_members
    where space_id = current_setting('t.shared')::uuid
      and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  1, 'the owner cannot leave their own space');

delete from public.spaces where id = current_setting('t.space_a')::uuid;
select is(
  (select count(*)::int from public.spaces where id = current_setting('t.space_a')::uuid),
  1, 'a personal space cannot be deleted');

delete from public.space_members
  where space_id = current_setting('t.shared')::uuid
    and user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
select is(
  (select count(*)::int from public.space_members
    where space_id = current_setting('t.shared')::uuid
      and user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  0, 'the owner can remove a member');

select is(
  (select count(*)::int from public.transactions where space_id = current_setting('t.shared')::uuid),
  1, 'a removed member''s transactions stay in the space');

select * from finish();
rollback;
