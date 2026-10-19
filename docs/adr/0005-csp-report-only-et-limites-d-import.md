# 0005 — CSP en Report-Only, en-têtes de sécurité et limites d'import

Status: accepted (implémenté dans l'issue 163)

## Contexte

Seul HSTS était posé. Le dépôt est public et l'app manipule des données
bancaires : il faut des en-têtes de base, une CSP, et des garde-fous sur
l'import de fichiers (taille, nombre de lignes, JSON invalide).

## Décision

- **En-têtes statiques** (`next.config.ts`) : HSTS, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (caméra, micro, géolocalisation, paiement coupés),
  `X-Frame-Options: DENY` et un `Content-Security-Policy: frame-ancestors
  'none'` **appliqué** (seule directive sans risque de casser l'app).
- **CSP complète avec nonce** (`lib/csp/build-csp.ts`, posée par `proxy.ts`)
  en **`Content-Security-Policy-Report-Only`**. Un nonce par requête rend les
  pages dynamiques (le layout lit `headers()`), c'est le prix de la méthode
  documentée par Next 16. Le nonce est appliqué aux deux scripts anti-FOUC de
  `app/layout.tsx` et au `<style>` de `components/ui/chart.tsx`
  (via `lib/csp/nonce-context.tsx`). `connect-src` autorise
  `NEXT_PUBLIC_SUPABASE_URL` (https + wss).
- **Pourquoi Report-Only d'abord** : une CSP stricte posée d'un coup peut
  casser silencieusement une page (Recharts et Radix posent des attributs
  `style=""`, les scripts Vercel Analytics/Speed Insights, les polices). En
  Report-Only, rien n'est bloqué et la console du navigateur liste ce qui
  l'aurait été.
- **Limites d'import** : 2 Mo (413), 5000 lignes parsées (422), `formData()`
  et `request.json()` protégés (400), extensions et MIME attendus uniquement,
  `xlsx` chargé dynamiquement dans la branche xls/xlsx seulement.
- **Erreurs** : `pgErrorResponse` ne renvoie le message Postgres que pour les
  erreurs métier (23514, 23505, 42501) ; sinon message générique, détail
  tronqué dans le log serveur. Jamais d'objet d'erreur ni de contenu de fichier
  dans les logs.

## Passer en enforcing

1. Naviguer l'app (login, dashboard, import, graphiques) avec la console
   ouverte, en production ou en preview, et relever les violations
   « [Report Only] ».
2. Corriger ou autoriser explicitement chaque source légitime dans
   `buildCsp` ; viser zéro violation sur les parcours principaux.
3. Dans `proxy.ts`, remplacer le nom d'en-tête
   `Content-Security-Policy-Report-Only` par `Content-Security-Policy` (requête
   et réponse), retirer la ligne `frame-ancestors` redondante de
   `next.config.ts` si souhaité, puis surveiller après déploiement.
4. Option : retirer `style-src-attr 'unsafe-inline'` une fois les attributs
   `style` inline supprimés.
