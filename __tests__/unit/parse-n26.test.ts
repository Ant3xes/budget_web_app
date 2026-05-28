import { describe, expect, it } from "vitest";

import { parseN26Csv } from "@/lib/import/parse-n26";

const SAMPLE_CSV = `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""
"2026-01-10","2026-01-10","Employeur SA","","Credit Transfer","Salaire janvier","Compte courant","2500.00","",""
"2026-01-05","2026-01-05","Lidl","","Presentment","","Compte courant","-42.30","",""`;

describe("parseN26Csv", () => {
  it("parses valid N26 CSV", () => {
    const result = parseN26Csv(SAMPLE_CSV);
    expect(result).toHaveLength(3);
  });

  it("converts amounts to cents correctly", () => {
    const result = parseN26Csv(SAMPLE_CSV);
    expect(result[0]?.amount_cents).toBe(-1599);
    expect(result[1]?.amount_cents).toBe(250000);
    expect(result[2]?.amount_cents).toBe(-4230);
  });

  it("preserves dates in YYYY-MM-DD format", () => {
    const result = parseN26Csv(SAMPLE_CSV);
    expect(result[0]?.date).toBe("2026-01-15");
    expect(result[1]?.date).toBe("2026-01-10");
  });

  it("uses partner name as description", () => {
    const result = parseN26Csv(SAMPLE_CSV);
    expect(result[0]?.description).toBe("Netflix");
    expect(result[1]?.description).toBe("Employeur SA");
  });

  it("returns empty array for CSV with only headers", () => {
    const csv = `"Booking Date","Partner Name","Amount (EUR)"`;
    expect(parseN26Csv(csv)).toHaveLength(0);
  });

  it("returns empty array for empty content", () => {
    expect(parseN26Csv("")).toHaveLength(0);
    expect(parseN26Csv("\n\n")).toHaveLength(0);
  });

  it("returns empty array when required headers are missing", () => {
    const csv = `"Date","Description","Value"
"2026-01-01","Test","10.00"`;
    expect(parseN26Csv(csv)).toHaveLength(0);
  });

  it("skips rows with invalid amounts", () => {
    const csv = `"Booking Date","Partner Name","Amount (EUR)"
"2026-01-01","Valid","-10.00"
"2026-01-02","Invalid","not-a-number"`;
    const result = parseN26Csv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe("Valid");
  });

  it("handles comma decimal separator in amounts", () => {
    const csv = `"Booking Date","Partner Name","Amount (EUR)"
"2026-01-01","Shop","-12,50"`;
    const result = parseN26Csv(csv);
    expect(result[0]?.amount_cents).toBe(-1250);
  });

  it("also accepts legacy Payee column name", () => {
    const csv = `"Booking Date","Payee","Amount (EUR)"
"2026-01-01","Legacy Shop","-5.00"`;
    const result = parseN26Csv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe("Legacy Shop");
  });
});
