import { z } from "zod";

/**
 * Shared field schemas for the API routes (security audit).
 *
 * The database stores amounts in `integer` (32-bit) columns, so a larger
 * value used to reach Postgres and come back as a raw "integer out of range"
 * error. A date such as `2026-13-45` matched the old format-only regex and
 * failed the same way. Both are now rejected with a clear 400 at the edge.
 */
export const MAX_AMOUNT_CENTS = 2_147_483_647;

export const amountCentsSchema = z.number().int().min(-MAX_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS);
export const positiveAmountCentsSchema = z.number().int().positive().max(MAX_AMOUNT_CENTS);
export const nonNegativeAmountCentsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS);

const isRealDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** `YYYY-MM-DD` that is a real calendar date (no month 13, no 31 February). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .refine(isRealDate, "Date invalide");

/** `YYYY-MM` with a month between 01 and 12. */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format YYYY-MM requis");

/** `#rgb`, `#rrggbb` or `#rrggbbaa`: the only color shapes the UI swatches produce. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Couleur invalide");
