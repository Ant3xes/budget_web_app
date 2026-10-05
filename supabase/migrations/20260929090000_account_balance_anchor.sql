-- Date d'ancrage du solde (issue 104, ADR 0003).
--
-- Solde = initial_balance_cents + somme des transactions non supprimées dont
-- date > balance_anchor_date. Les comptes existants reçoivent '1900-01-01' :
-- toutes leurs opérations continuent de compter, leurs soldes ne changent pas.
-- Pour les nouveaux comptes, l'API fixe la date du jour (Europe/Paris) ; le
-- défaut current_date n'est qu'un filet de sécurité.

alter table public.accounts
  add column balance_anchor_date date not null default date '1900-01-01';

alter table public.accounts
  alter column balance_anchor_date set default current_date;
