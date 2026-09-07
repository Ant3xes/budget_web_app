export const periodSelector = {
  presets: {
    "1m": "This month",
    "3m": "3 months",
    "6m": "6 months",
    "1a": "1 year",
    tout: "All",
  },
  custom: {
    label: "Custom",
    fromLabel: "Start month",
    toLabel: "End month",
    apply: "Apply",
  },
} as const;
