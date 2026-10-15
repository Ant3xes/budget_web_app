import { describe, expect, it } from "vitest";

import { ConversionError, planConversion, uiKindOf } from "@/lib/transactions/convert-transaction";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CAT = "33333333-3333-4333-8333-333333333333";

describe("planConversion", () => {
  it("expense -> income flips kind and sign", () => {
    const plan = planConversion({ currentKind: "expense", targetKind: "income", amountCents: 1500, accountId: A, categoryId: CAT });
    expect(plan).toMatchObject({ kind: "income", amountCents: 1500, accountId: A, categoryId: CAT, mirror: null, dropExistingMirror: false });
  });

  it("income -> expense flips kind and sign", () => {
    const plan = planConversion({ currentKind: "income", targetKind: "expense", amountCents: 1500, accountId: A });
    expect(plan).toMatchObject({ kind: "expense", amountCents: -1500, mirror: null });
  });

  it("expense -> transfer makes a debit on the source with a credit mirror, no category", () => {
    const plan = planConversion({ currentKind: "expense", targetKind: "transfer", amountCents: 1500, accountId: A, fromAccountId: A, toAccountId: B, categoryId: CAT });
    expect(plan).toMatchObject({
      kind: "transfer_debit",
      accountId: A,
      amountCents: -1500,
      categoryId: null,
      isTransfer: true,
      mirror: { kind: "transfer_credit", accountId: B, amountCents: 1500 },
      dropExistingMirror: false,
    });
  });

  it("income -> transfer makes a credit on the destination with a debit mirror", () => {
    const plan = planConversion({ currentKind: "income", targetKind: "transfer", amountCents: 1500, accountId: B, fromAccountId: A, toAccountId: B });
    expect(plan).toMatchObject({
      kind: "transfer_credit",
      accountId: B,
      amountCents: 1500,
      categoryId: null,
      mirror: { kind: "transfer_debit", accountId: A, amountCents: -1500 },
    });
  });

  it("transfer (debit side) -> expense drops the mirror and requires a category", () => {
    const plan = planConversion({ currentKind: "transfer_debit", targetKind: "expense", amountCents: 1500, accountId: A, categoryId: CAT });
    expect(plan).toMatchObject({ kind: "expense", amountCents: -1500, categoryId: CAT, mirror: null, dropExistingMirror: true });
    expect(() => planConversion({ currentKind: "transfer_debit", targetKind: "expense", amountCents: 1500, accountId: A })).toThrow(ConversionError);
  });

  it("transfer (credit side) -> income drops the mirror and requires a category", () => {
    const plan = planConversion({ currentKind: "transfer_credit", targetKind: "income", amountCents: 1500, accountId: B, categoryId: CAT });
    expect(plan).toMatchObject({ kind: "income", amountCents: 1500, categoryId: CAT, mirror: null, dropExistingMirror: true });
    expect(() => planConversion({ currentKind: "transfer_credit", targetKind: "income", amountCents: 1500, accountId: B, categoryId: null })).toThrow("Catégorie requise");
  });

  it("transfer -> transfer re-creates the pair with new accounts", () => {
    const plan = planConversion({ currentKind: "transfer_debit", targetKind: "transfer", amountCents: 900, accountId: A, fromAccountId: B, toAccountId: A });
    expect(plan).toMatchObject({ kind: "transfer_debit", accountId: B, amountCents: -900, dropExistingMirror: true, mirror: { kind: "transfer_credit", accountId: A, amountCents: 900 } });
  });

  it("rejects a transfer without both accounts or with identical accounts", () => {
    expect(() => planConversion({ currentKind: "expense", targetKind: "transfer", amountCents: 100, accountId: A, fromAccountId: A })).toThrow(ConversionError);
    expect(() => planConversion({ currentKind: "expense", targetKind: "transfer", amountCents: 100, accountId: A, fromAccountId: A, toAccountId: A })).toThrow(ConversionError);
  });

  it("rejects a zero amount and uses the absolute value of the amount", () => {
    expect(() => planConversion({ currentKind: "expense", targetKind: "income", amountCents: 0, accountId: A })).toThrow(ConversionError);
    expect(planConversion({ currentKind: "expense", targetKind: "expense", amountCents: -700, accountId: A }).amountCents).toBe(-700);
  });
});

describe("uiKindOf", () => {
  it("maps both transfer sides to transfer", () => {
    expect(uiKindOf("transfer_debit")).toBe("transfer");
    expect(uiKindOf("transfer_credit")).toBe("transfer");
    expect(uiKindOf("income")).toBe("income");
  });
});
