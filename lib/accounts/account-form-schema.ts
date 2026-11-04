import { z } from "zod";

import { ACCOUNT_TYPES } from "@/lib/constants";
import { parseEurosToCents } from "@/lib/accounts/parse-euros-to-cents";
import { MAX_AMOUNT_CENTS } from "@/lib/validation/fields";

/**
 * Form schema: the balance is typed in euros (string) and transformed into
 * `initialBalanceCents`. An invalid amount fails validation, so no request
 * is sent (issue 103).
 */
export function createAccountFormSchema(messages: { nameRequired: string; invalidBalance: string }) {
  return z
    .object({
      name: z.string().trim().min(1, messages.nameRequired).max(80),
      type: z.enum(ACCOUNT_TYPES),
      bank: z.string().trim().max(80).optional().or(z.literal("")),
      initialBalance: z.string(),
      currency: z.string().length(3),
    })
    .superRefine((value, ctx) => {
      const cents = parseEurosToCents(value.initialBalance);
      // The column is a 32-bit integer: refuse what it cannot store.
      if (cents === null || Math.abs(cents) > MAX_AMOUNT_CENTS) {
        ctx.addIssue({ code: "custom", path: ["initialBalance"], message: messages.invalidBalance });
      }
    })
    .transform(({ initialBalance, ...rest }) => ({
      ...rest,
      initialBalanceCents: parseEurosToCents(initialBalance) as number,
    }));
}
