import Link from "next/link";

const PHASES = [
  { name: "Phase 1 — Fondations", status: "done", items: "Auth, invitations, CRUD comptes, sidebar, migrations RLS" },
  { name: "Phase 2 — Transactions", status: "done", items: "Catégories, dépenses/revenus, virements, import CSV/XLS" },
  { name: "Phase 3 — Budget & Analytics", status: "done", items: "Budgets, charges fixes, objectifs, dashboard Recharts" },
  { name: "Phase 4 — Finition", status: "done", items: "Dark mode, tests, détail compte, profil, page /plan" },
] as const;

const FEATURES = [
  { module: "Auth", feature: "Login / signup / logout + invitations", status: "done" },
  { module: "Comptes", feature: "Liste cards + détail (historique + graphique solde)", status: "done" },
  { module: "Transactions", feature: "Dépenses, revenus, filtres, pagination", status: "done" },
  { module: "Virements", feature: "Paire débit/crédit liée par transfer_id", status: "done" },
  { module: "Import", feature: "N26 CSV + BNP XLS, dédup, règles mots-clés", status: "done" },
  { module: "Budget", feature: "Enveloppes mensuelles + recopie mois précédent", status: "done" },
  { module: "Charges fixes", feature: "CRUD + advanceDueDate + alertes Dashboard", status: "done" },
  { module: "Objectifs", feature: "Tracker épargne indépendant", status: "done" },
  { module: "Paramètres", feature: "Catégories, règles d'import, profil (nom + mdp)", status: "done" },
  { module: "Tests", feature: "Vitest + Playwright", status: "done" },
  { module: "Déploiement", feature: "Workflow CI + secrets GitHub à configurer manuellement", status: "manual" },
] as const;

const DECISIONS = [
  "Montants en centimes entiers (jamais de float)",
  "Soft delete via deleted_at sur transactions, comptes, charges, etc.",
  "Isolation utilisateur via RLS Supabase (user_id = auth.uid())",
  "transactions.kind : expense | income | transfer_debit | transfer_credit",
  "Clients Supabase distincts : SSR (createServerSupabaseClient) vs browser",
  "Fixed Charges = référentiel indépendant (pas de lien auto avec les transactions)",
] as const;

const STACK = [
  { layer: "Frontend", tech: "Next.js App Router + TypeScript" },
  { layer: "Styling", tech: "Tailwind CSS v4" },
  { layer: "BDD + Auth", tech: "Supabase (PostgreSQL + RLS)" },
  { layer: "Graphiques", tech: "Recharts" },
  { layer: "Formulaires", tech: "React Hook Form + Zod" },
  { layer: "Tests", tech: "Vitest + Playwright" },
  { layer: "Déploiement", tech: "Vercel + Supabase Cloud" },
] as const;

function StatusBadge({ status }: { status: "done" | "manual" }) {
  if (status === "done") {
    return (
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
        Fait
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      Manuel
    </span>
  );
}

export default function PlanPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Budget &amp; Comptes — v1.8</p>
        <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          État d&apos;avancement du projet et décisions d&apos;architecture. Contenu statique, mis à
          jour au déploiement.{" "}
          <a
            href="https://github.com/Ant3xes/budget_web_app/blob/main/PRD.md"
            className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Voir PRD.md
          </a>
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-medium">Phases</h2>
        <ul className="space-y-3">
          {PHASES.map((phase) => (
            <li
              key={phase.name}
              className="flex flex-col gap-1 border-b border-zinc-200 pb-3 dark:border-zinc-700 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium">{phase.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{phase.items}</p>
              </div>
              <StatusBadge status="done" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-medium">Features par module</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-4 font-medium">Module</th>
                <th className="py-2 pr-4 font-medium">Feature</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row) => (
                <tr key={`${row.module}-${row.feature}`} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4 whitespace-nowrap">{row.module}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{row.feature}</td>
                  <td className="py-2">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-medium">Décisions techniques</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {DECISIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-medium">Stack</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {STACK.map((row) => (
              <tr key={row.layer} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-4 font-medium whitespace-nowrap">{row.layer}</td>
                <td className="py-2 text-zinc-600 dark:text-zinc-400">{row.tech}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-medium">Déploiement</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Le workflow CI (`.github/workflows/deploy.yml`) est en place. La configuration des secrets
          GitHub (`VERCEL_*`, `SUPABASE_*`, comptes E2E) reste manuelle — voir le README du repo.
        </p>
      </section>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="underline underline-offset-2">
          Connexion
        </Link>
      </p>
    </main>
  );
}
