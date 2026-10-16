import { describe, expect, it } from "vitest";

import {
  buildKindFields,
  isChoiceComplete,
  markAllExternal,
  markAllInternal,
  pendingTransferRows,
  type TransferChoice,
} from "@/lib/import/transfer-choice";

const rows = [
  { rowId: "e_0", kind: "expense" as const },
  { rowId: "e_1", kind: "expense" as const },
  { rowId: "i_0", kind: "income" as const },
  { rowId: "e_2", kind: "expense" as const, is_duplicate: true },
];
const isTransfer = { e_0: true, e_1: true, i_0: true, e_2: true };
const checked = { e_0: true, e_1: true, i_0: true, e_2: true };
const IMPORT = "acc-import";

describe("isChoiceComplete", () => {
  it("rejects missing choice, internal without account or to the import account", () => {
    expect(isChoiceComplete(undefined, IMPORT)).toBe(false);
    expect(isChoiceComplete({ type: "internal", accountId: "" }, IMPORT)).toBe(false);
    expect(isChoiceComplete({ type: "internal", accountId: IMPORT }, IMPORT)).toBe(false);
  });
  it("accepts external and internal to another account", () => {
    expect(isChoiceComplete({ type: "external" }, IMPORT)).toBe(true);
    expect(isChoiceComplete({ type: "internal", accountId: "other" }, IMPORT)).toBe(true);
  });
});

describe("pendingTransferRows", () => {
  it("lists checked transfer rows without a choice, ignoring duplicates", () => {
    const choices: Record<string, TransferChoice> = { e_0: { type: "external" } };
    expect(pendingTransferRows(rows, isTransfer, checked, choices, IMPORT).map((r) => r.rowId)).toEqual([
      "e_1",
      "i_0",
    ]);
  });
  it("ignores unchecked rows and rows not in transfer state", () => {
    expect(pendingTransferRows(rows, { e_0: true }, { e_0: false }, {}, IMPORT)).toEqual([]);
    expect(pendingTransferRows(rows, {}, checked, {}, IMPORT)).toEqual([]);
  });
  it("is empty once everything is chosen", () => {
    const choices = markAllExternal({}, rows);
    expect(pendingTransferRows(rows, isTransfer, checked, choices, IMPORT)).toEqual([]);
  });
});

describe("bulk actions", () => {
  it("markAllExternal sets every row external", () => {
    const next = markAllExternal({ e_0: { type: "internal", accountId: "x" } }, rows);
    expect(Object.values(next).every((c) => c?.type === "external")).toBe(true);
  });
  it("markAllInternal sets the counterpart account on every row", () => {
    const next = markAllInternal({}, rows, "acc-b", IMPORT);
    expect(next.e_1).toEqual({ type: "internal", accountId: "acc-b" });
    expect(next.i_0).toEqual({ type: "internal", accountId: "acc-b" });
  });
  it("markAllInternal refuses the import account", () => {
    const before = { e_0: { type: "external" } as TransferChoice };
    expect(markAllInternal(before, rows, IMPORT, IMPORT)).toBe(before);
  });
});

describe("buildKindFields", () => {
  it("internal => transfer with counterpart, no category", () => {
    expect(
      buildKindFields({ kind: "expense" }, true, { type: "internal", accountId: "acc-b" }, "cat", IMPORT),
    ).toEqual({ kind: "transfer", category_id: null, transfer_account_id: "acc-b" });
  });
  it("external => expense/income keeping the category", () => {
    expect(buildKindFields({ kind: "expense" }, true, { type: "external" }, "cat", IMPORT)).toEqual({
      kind: "expense",
      category_id: "cat",
    });
    expect(buildKindFields({ kind: "income" }, true, { type: "external" }, null, IMPORT)).toEqual({
      kind: "income",
      category_id: null,
    });
  });
  it("non-transfer rows are untouched", () => {
    expect(buildKindFields({ kind: "income" }, false, undefined, "cat", IMPORT)).toEqual({
      kind: "income",
      category_id: "cat",
    });
  });
  it("throws on a transfer row without choice", () => {
    expect(() => buildKindFields({ kind: "expense" }, true, undefined, null, IMPORT)).toThrow();
  });
});
