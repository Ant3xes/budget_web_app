import { accounts } from "./accounts";
import { analytics } from "./analytics";
import { auth } from "./auth";
import { balance } from "./balance";
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
import { sharedExpenses } from "./sharedExpenses";
import { transactions } from "./transactions";

/** English counterpart of `../fr/index.ts` — see its docstring. */
export const en = {
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
  sharedExpenses,
  balance,
  auth,
  profile,
  importRules,
  analytics,
} as const;
