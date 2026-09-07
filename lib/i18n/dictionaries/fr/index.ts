import { accounts } from "./accounts";
import { analytics } from "./analytics";
import { auth } from "./auth";
import { budget } from "./budget";
import { categories } from "./categories";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { fixedCharges } from "./fixedCharges";
import { goals } from "./goals";
import { importRules } from "./importRules";
import { invitations } from "./invitations";
import { nav } from "./nav";
import { periodSelector } from "./period-selector";
import { profile } from "./profile";
import { settings } from "./settings";
import { transactions } from "./transactions";

/**
 * One file per domain (plan Étape 1) so parallel translation work never
 * touches the same file twice — each domain's dictionary lives in its own
 * `fr/<domain>.ts` / `en/<domain>.ts` pair, merged here into the single
 * object `useLocale()`'s `t()` looks keys up in (dot-path, e.g.
 * "dashboard.title").
 */
export const fr = {
  common,
  nav,
  categories,
  dashboard,
  periodSelector,
  settings,
  accounts,
  transactions,
  budget,
  fixedCharges,
  goals,
  invitations,
  auth,
  profile,
  importRules,
  analytics,
} as const;
