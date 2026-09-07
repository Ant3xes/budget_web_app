/**
 * `presets` keys mirror `PeriodPreset` (lib/dates/period.ts): "1m", "3m",
 * "6m", "1a", "tout" — shared by /dashboard and /analytics via
 * `components/period-selector.tsx`.
 */
export const periodSelector = {
  presets: {
    "1m": "Ce mois",
    "3m": "3 mois",
    "6m": "6 mois",
    "1a": "1 an",
    tout: "Tout",
  },
  custom: {
    label: "Personnalisé",
    fromLabel: "Mois de début",
    toLabel: "Mois de fin",
    apply: "Appliquer",
  },
} as const;
