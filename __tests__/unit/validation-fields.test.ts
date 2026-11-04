import { describe, expect, it } from "vitest";

import { createAccountFormSchema } from "@/lib/accounts/account-form-schema";
import {
  MAX_AMOUNT_CENTS,
  amountCentsSchema,
  hexColorSchema,
  isoDateSchema,
  monthSchema,
  nonNegativeAmountCentsSchema,
  positiveAmountCentsSchema,
} from "@/lib/validation/fields";

describe("amount schemas (32-bit integer columns)", () => {
  it("accepts the whole range the database can store", () => {
    expect(amountCentsSchema.safeParse(MAX_AMOUNT_CENTS).success).toBe(true);
    expect(amountCentsSchema.safeParse(-MAX_AMOUNT_CENTS).success).toBe(true);
    expect(positiveAmountCentsSchema.safeParse(1).success).toBe(true);
    expect(nonNegativeAmountCentsSchema.safeParse(0).success).toBe(true);
  });

  it.each([MAX_AMOUNT_CENTS + 1, -MAX_AMOUNT_CENTS - 1, Number.MAX_SAFE_INTEGER, 1.5, Number.NaN])(
    "rejects %s",
    (value) => {
      expect(amountCentsSchema.safeParse(value).success).toBe(false);
    },
  );

  it("keeps the sign rules of the positive / non-negative variants", () => {
    expect(positiveAmountCentsSchema.safeParse(0).success).toBe(false);
    expect(positiveAmountCentsSchema.safeParse(MAX_AMOUNT_CENTS + 1).success).toBe(false);
    expect(nonNegativeAmountCentsSchema.safeParse(-1).success).toBe(false);
    expect(nonNegativeAmountCentsSchema.safeParse(MAX_AMOUNT_CENTS + 1).success).toBe(false);
  });
});

describe("isoDateSchema", () => {
  it.each(["2026-01-31", "2024-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(true);
  });

  it.each(["2026-13-01", "2026-00-10", "2026-02-30", "2025-02-29", "2026-04-31", "2026-1-1", "26-01-01", "", "2026-01-01T00:00"])(
    "rejects %s",
    (value) => {
      expect(isoDateSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("monthSchema", () => {
  it.each(["2026-01", "2026-12"])("accepts %s", (value) => {
    expect(monthSchema.safeParse(value).success).toBe(true);
  });
  it.each(["2026-00", "2026-13", "2026-1", "2026-99", "2026-01-01"])("rejects %s", (value) => {
    expect(monthSchema.safeParse(value).success).toBe(false);
  });
});

describe("hexColorSchema", () => {
  it.each(["#fff", "#22c55e", "#22C55E80"])("accepts %s", (value) => {
    expect(hexColorSchema.safeParse(value).success).toBe(true);
  });
  it.each(["blue", "red;background:url(x)", "#12", "#gggggg", "22c55e", "url(javascript:alert(1))", ""])("rejects %j", (value) => {
    expect(hexColorSchema.safeParse(value).success).toBe(false);
  });
});

describe("account form schema balance bound", () => {
  const schema = createAccountFormSchema({ nameRequired: "name", invalidBalance: "balance" });
  const parse = (initialBalance: string) =>
    schema.safeParse({ name: "Courant", type: "courant", initialBalance, currency: "EUR" });

  it("accepts a balance the integer column can hold", () => {
    expect(parse("1234,56").success).toBe(true);
  });

  it("rejects a balance above 32-bit cents (≈ 21 474 836,47 €)", () => {
    expect(parse("21474837").success).toBe(false);
    expect(parse("-21474837").success).toBe(false);
  });
});
