-- Backfill is_default/translation_key (added in
-- 20260907120000_add_category_defaults_i18n.sql) onto categories seeded
-- before that migration — without this, every account created before it
-- keeps seeing its default categories in French regardless of locale,
-- while every account created after it correctly follows the language
-- toggle. Matches on the exact (name, kind) pairs seed_default_categories()
-- inserts; a category a user already renamed away from its seeded name
-- won't match and correctly stays untouched (it's no longer "the default
-- category" in any meaningful sense).
update public.categories set is_default = true, translation_key = v.translation_key
from (values
  ('Alimentation',   'expense',  'alimentation'),
  ('Logement',       'expense',  'logement'),
  ('Transport',      'expense',  'transport'),
  ('Santé',          'expense',  'sante'),
  ('Loisirs',        'expense',  'loisirs'),
  ('Vêtements',      'expense',  'vetements'),
  ('Restaurants',    'expense',  'restaurants'),
  ('Voyages',        'expense',  'voyages'),
  ('Abonnements',    'expense',  'abonnements'),
  ('Education',      'expense',  'education'),
  ('Cadeaux',        'expense',  'cadeaux'),
  ('Banque & Frais', 'expense',  'banque_frais'),
  ('Salaire',        'income',   'salaire'),
  ('Freelance',      'income',   'freelance'),
  ('Remboursement',  'income',   'remboursement'),
  ('Autre revenu',   'income',   'autre_revenu'),
  ('Virement interne', 'transfer', 'virement_interne')
) as v(name, kind, translation_key)
where categories.name = v.name
  and categories.kind = v.kind
  and categories.is_default = false;
