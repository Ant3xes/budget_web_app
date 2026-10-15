type LabelRow = { description: string; clean_description?: string | null };

/** Label shown in the preview table: the clean one (raw bank label goes in the tooltip). */
export const labelForDisplay = (r: LabelRow) => r.clean_description || r.description;

/** issue 130: the clean label becomes the description, the raw one is sent as raw_label. */
export function labelFields(r: LabelRow) {
  return { description: labelForDisplay(r), raw_label: r.description };
}
