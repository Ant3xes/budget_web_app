import { expect, it } from "vitest";
import { apiErrorMessage } from "@/lib/api/error-message";

it("localizes demo denial and preserves other API errors", () => {
  const t = (key: string) => key === "common.demo.readOnly" ? "Read-only demo account" : key;
  expect(apiErrorMessage("Compte demo en lecture seule", "fallback", t)).toBe("Read-only demo account");
  expect(apiErrorMessage("Other error", "fallback", t)).toBe("Other error");
  expect(apiErrorMessage(undefined, "fallback", t)).toBe("fallback");
});
