-- Fix missing table privileges for PostgREST roles.
-- After a recent local reset, authenticated/anon only had TRUNCATE/REFERENCES/TRIGGER
-- (no SELECT/INSERT/UPDATE/DELETE), so the API returned 400 and the UI looked empty
-- despite seeded rows existing. RLS still scopes rows to auth.uid().

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
