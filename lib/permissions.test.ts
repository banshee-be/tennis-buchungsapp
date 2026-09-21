import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("Admin-Berechtigungen", () => {
  it("beschränkt Kassierer auf Beitragsdaten", () => {
    expect(hasPermission("TREASURER", "members.finance")).toBe(true);
    expect(hasPermission("TREASURER", "members.roles")).toBe(false);
    expect(hasPermission("TREASURER", "courts.manage")).toBe(false);
  });

  it("behandelt die bisherige ADMIN-Rolle als Super-Admin", () => {
    expect(hasPermission("ADMIN", "settings.manage")).toBe(true);
    expect(hasPermission("ADMIN", "members.roles")).toBe(true);
  });
});
