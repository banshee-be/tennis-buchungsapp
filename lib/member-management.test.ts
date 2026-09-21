import { describe, expect, it } from "vitest";
import { duplicateScore, findDuplicatePairs } from "@/lib/member-management";

describe("Mitglieder-Dubletten", () => {
  const base = { id: "1", name: "Max Müller", email: "max@example.de", memberNumber: "123", birthDate: "1990-01-01" };

  it("erkennt gleiche E-Mail und Mitgliedsnummer zuverlässig", () => {
    expect(duplicateScore(base, { ...base, id: "2", name: "M. Müller" }).score).toBe(245);
  });

  it("meldet Namen allein nicht als sichere Dublette", () => {
    expect(findDuplicatePairs([base, { id: "2", name: "Max Muller", email: "anders@example.de" }])).toHaveLength(0);
  });
});
