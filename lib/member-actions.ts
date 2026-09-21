export type LifecycleSnapshot = {
  membershipStatus: string;
  lifecycleStatus: string;
  isActive: boolean;
  archivedAt?: Date | string | null;
};

export function isMemberActionApplied(action: string, user: LifecycleSnapshot) {
  if (action === "approve") return user.membershipStatus === "VERIFIED" && user.lifecycleStatus === "ACTIVE" && user.isActive;
  if (action === "reject") return user.membershipStatus === "REJECTED" && user.lifecycleStatus === "ENDED" && !user.isActive;
  if (action === "pause") return user.lifecycleStatus === "PAUSED" && !user.isActive;
  if (action === "resign") return user.lifecycleStatus === "RESIGNED" && !user.isActive;
  if (action === "reactivate") return user.lifecycleStatus === "ACTIVE" && user.isActive && !user.archivedAt;
  if (action === "archive") return user.lifecycleStatus === "ARCHIVED" && !user.isActive && Boolean(user.archivedAt);
  return false;
}
