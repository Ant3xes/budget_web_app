import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Budget & Comptes",
};

/**
 * Page statique, en français uniquement (voir le même choix documenté dans
 * `app/(legal)/rgpd/page.tsx`). Hors du groupe `(app)`, accessible sans
 * authentification.
 */
export default function CguPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <header className="mb-10 space-y-2">
        <p className="text-sm text-muted-foreground">Budget &amp; Comptes</p>
        <h1 className="text-3xl font-semibold tracking-tight">Conditions d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : 28 septembre 2026.</p>
      </header>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Objet du service</h2>
        <p className="text-sm text-foreground/80">
          Budget &amp; Comptes est un service de suivi de budget et de comptes bancaires personnels :
          saisie et import de transactions, gestion de budgets et de charges fixes, suivi
          d&apos;objectifs d&apos;épargne, et partage optionnel entre plusieurs utilisateurs au sein
          d&apos;un espace commun. C&apos;est un projet personnel de Romain Pereira, non
          commercialisé, fourni « en l&apos;état » sans garantie de disponibilité continue.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Compte utilisateur</h2>
        <p className="text-sm text-foreground/80">
          L&apos;accès au service nécessite la création d&apos;un compte (email + mot de passe). Vous
          êtes responsable de la confidentialité de vos identifiants et de l&apos;exactitude des
          informations que vous fournissez ou importez.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Espaces partagés</h2>
        <p className="text-sm text-foreground/80">
          Un utilisateur peut être invité à rejoindre un espace partagé. Les membres d&apos;un même
          espace ont accès aux mêmes données financières au sein de cet espace ; un utilisateur
          n&apos;a jamais accès aux données d&apos;un espace dont il n&apos;est pas membre.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Propriété des données</h2>
        <p className="text-sm text-foreground/80">
          Vous restez propriétaire des données que vous saisissez ou importez. Vous pouvez à tout
          moment en demander l&apos;export ou la suppression complète (voir la{" "}
          <Link href="/rgpd" className="underline underline-offset-2">
            politique de confidentialité
          </Link>
          ).
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Responsabilité</h2>
        <p className="text-sm text-foreground/80">
          Le service est fourni à titre gratuit et sans garantie. L&apos;éditeur ne saurait être tenu
          responsable d&apos;une perte de données, d&apos;une indisponibilité du service, ou
          d&apos;une erreur dans les montants ou catégorisations calculés automatiquement (import,
          règles de catégorisation). Vérifiez toujours vos données financières importantes par
          vous-même.
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Résiliation</h2>
        <p className="text-sm text-foreground/80">
          Vous pouvez cesser d&apos;utiliser le service à tout moment et demander la suppression de
          votre compte et de vos données via{" "}
          <a href="mailto:contact@budget-comptes.app" className="underline underline-offset-2">
            contact@budget-comptes.app
          </a>
          .
        </p>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xl font-medium">Droit applicable</h2>
        <p className="text-sm text-foreground/80">
          Les présentes conditions sont soumises au droit français.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link href="/rgpd" className="underline underline-offset-2">
          Politique de confidentialité
        </Link>{" "}
        ·{" "}
        <Link href="/login" className="underline underline-offset-2">
          Connexion
        </Link>
      </p>
    </main>
  );
}
