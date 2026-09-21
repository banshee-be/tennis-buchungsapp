import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/admin-user-csv";

describe("CSV-Export", () => {
  it("neutralisiert Tabellenformeln in personenbezogenen Daten", () => {
    const csv = toCsv([["=HYPERLINK(\"https://example.invalid\")", "+1+1", "@SUM(A1:A2)", "-2+3"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("'-2+3");
  });
});
