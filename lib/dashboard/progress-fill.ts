/**
 * Transform CSS d'une barre de progression remplie à `pct` % (0-100).
 *
 * Le remplissage fait 100 % de la piste et se décale vers la gauche de
 * (100 - pct) % : on anime `transform` (composité GPU) au lieu de `width`
 * (layout à chaque frame). Valeur arrondie à 2 décimales : `pct - 100` brut
 * donne `-1.4210854715202004e-14%` (notation scientifique, CSS invalide) ou
 * `-66.66666666666667%` selon le ratio.
 */
export function progressFillTransform(pct: number): string {
  const safe = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  const offset = Math.round((100 - safe) * 100) / 100;
  return `translateX(${offset === 0 ? 0 : -offset}%)`;
}
