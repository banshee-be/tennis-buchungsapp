import { describe, expect, it } from "vitest";
import { isMemberActionApplied } from "@/lib/member-actions";

describe("Mitgliederaktionen", () => {
  it("erkennt eine bereits bestätigte Mitgliedschaft und verhindert doppelte Verarbeitung", () => {
    expect(isMemberActionApplied("approve", { membershipStatus: "VERIFIED", lifecycleStatus: "ACTIVE", isActive: true })).toBe(true);
  });

  it("erkennt noch nicht ausgeführte und abgebrochene Statuswechsel", () => {
    expect(isMemberActionApplied("approve", { membershipStatus: "PENDING", lifecycleStatus: "ACTIVE", isActive: true })).toBe(false);
    expect(isMemberActionApplied("archive", { membershipStatus: "VERIFIED", lifecycleStatus: "ACTIVE", isActive: true })).toBe(false);
  });
});
