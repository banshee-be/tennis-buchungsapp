export const adminRoles = ["ADMIN", "SUPER_ADMIN", "MEMBER_MANAGER", "SPORTS_MANAGER", "TREASURER", "COURT_MANAGER"] as const;
export type AppRole = "USER" | (typeof adminRoles)[number];

export type Permission =
  | "admin.access"
  | "members.read"
  | "members.write"
  | "members.export"
  | "members.roles"
  | "members.finance"
  | "members.keys"
  | "members.sports"
  | "bookings.manage"
  | "courts.read"
  | "courts.manage"
  | "settings.manage";

const rolePermissions: Record<AppRole, readonly Permission[]> = {
  USER: [],
  ADMIN: ["admin.access", "members.read", "members.write", "members.export", "members.roles", "members.finance", "members.keys", "members.sports", "bookings.manage", "courts.read", "courts.manage", "settings.manage"],
  SUPER_ADMIN: ["admin.access", "members.read", "members.write", "members.export", "members.roles", "members.finance", "members.keys", "members.sports", "bookings.manage", "courts.read", "courts.manage", "settings.manage"],
  MEMBER_MANAGER: ["admin.access", "members.read", "members.write", "members.export", "members.keys"],
  SPORTS_MANAGER: ["admin.access", "members.read", "members.sports", "bookings.manage", "courts.read"],
  TREASURER: ["admin.access", "members.read", "members.export", "members.finance"],
  COURT_MANAGER: ["admin.access", "members.read", "bookings.manage", "courts.read", "courts.manage"]
};

export function normalizeRole(role: string): AppRole {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "MEMBER_MANAGER" || role === "SPORTS_MANAGER" || role === "TREASURER" || role === "COURT_MANAGER"
    ? role
    : "USER";
}

export function hasPermission(role: string, permission: Permission) {
  return rolePermissions[normalizeRole(role)].includes(permission);
}

export function permissionsForRole(role: string) {
  return [...rolePermissions[normalizeRole(role)]];
}
