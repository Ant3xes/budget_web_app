import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Budget & Comptes",
};

/**
 * Page statique, en français uniquement (même choix que `app/plan/page.tsx` :
 * pas de passage par `useLocale()`/le système i18n pour du contenu légal).
 * Hors du groupe `(app)` donc pas de redirection par `(app)/layout.tsx` —
 * accessible sans authentification.
 */
export default function RgpdPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-muted-foreground">Budget &amp; Comptes</p>
        <h1 className="text-3xl font-semibold tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : 28 septembre 2026.</p>
      </header>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Responsable du traitement</h2>
        <p className="text-sm text-foreground/80">
          Budget &amp; Comptes est un projet personnel de Romain Pereira, non commercialisé (pas de
          société ni de SIRET associé). Pour toute question ou demande relative à vos données,
          contactez{" "}
          <a href="mailto:contact@budget-comptes.app" className="underline underline-offset-2">
            contact@budget-comptes.app
          </a>
          .
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Données collectées</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/80">
          <li>
            <strong>Compte</strong> : adresse email et mot de passe (haché, jamais stocké en clair),
            gérés par Supabase Auth.
          </li>
          <li>
            <strong>Données financières</strong> : comptes bancaires, transactions, budgets, charges
            fixes et objectifs d&apos;épargne que vous saisissez ou importez (fichiers CSV/XLS de
            votre banque).
          </li>
          <li>
            <strong>Données de partage</strong> : si vous invitez un autre utilisateur dans un espace
            partagé, son email et les données financières de cet espace lui sont accessibles selon
            les règles d&apos;isolation décrites ci-dessous.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Finalité et base légale</h2>
        <p className="text-sm text-foreground/80">
          Ces données sont utilisées exclusivement pour fournir le service de suivi de budget et de
          comptes bancaires personnels (exécution du contrat d&apos;utilisation, article 6.1.b du
          RGPD). Aucune donnée n&apos;est utilisée à des fins publicitaires, revendue ou partagée avec
          un tiers en dehors des sous-traitants techniques listés ci-dessous.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Durée de conservation</h2>
        <p className="text-sm text-foreground/80">
          Vos données sont conservées tant que votre compte est actif. Les suppressions (transactions,
          comptes, charges) sont des suppressions logiques (<code>deleted_at</code>) puis purgées
          définitivement lors de la suppression du compte, sur demande.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Sous-traitants</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/80">
          <li>
            <strong>Supabase</strong> (hébergement de la base de données PostgreSQL et de
            l&apos;authentification). Isolation stricte des données par espace via des règles RLS
            (Row Level Security) : un utilisateur ne peut jamais lire les données d&apos;un espace
            dont il n&apos;est pas membre.
          </li>
          <li>
            <strong>Vercel</strong> (hébergement de l&apos;application web et exécution du code
            serveur).
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Vos droits</h2>
        <p className="text-sm text-foreground/80">
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement et de portabilité de vos données. La rectification et l&apos;accès sont
          disponibles directement dans l&apos;application (page Profil, export des transactions).
          Pour l&apos;effacement complet du compte ou toute autre demande, contactez{" "}
          <a href="mailto:contact@budget-comptes.app" className="underline underline-offset-2">
            contact@budget-comptes.app
          </a>
          .
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link href="/cgu" className="underline underline-offset-2">
          Conditions d&apos;utilisation
        </Link>{" "}
        ·{" "}
        <Link href="/login" className="underline underline-offset-2">
          Connexion
        </Link>
      </p>
    </main>
  );
}
