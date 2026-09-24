-- Supabase linter 0011 (function_search_path_mutable): pin the search_path of
-- the trigger functions added with spaces. None of them reads a table by an
-- unqualified name, so behaviour is unchanged.
alter function public.prevent_space_change() set search_path = public;
alter function public.prevent_space_identity_change() set search_path = public;
alter function public.guard_invitation_update() set search_path = public;
