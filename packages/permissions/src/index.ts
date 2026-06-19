import type { PermissionCode, TenantMemberRow, UUID } from "@hospedex/types";

export type PermissionContext = {
  userId: UUID;
  platformRole?: "user" | "super_admin";
  tenantId?: UUID;
  propertyId?: UUID;
  memberships?: readonly TenantMemberRow[];
  permissionsByRoleId?: ReadonlyMap<UUID, readonly PermissionCode[]>;
};

export function isSuperAdmin(context: PermissionContext): boolean {
  return context.platformRole === "super_admin";
}

export function getActiveMembership(context: PermissionContext): TenantMemberRow | undefined {
  return context.memberships?.find(
    (member) =>
      member.user_id === context.userId &&
      member.tenant_id === context.tenantId &&
      member.status === "active"
  );
}

export function isTenantOwner(context: PermissionContext): boolean {
  return isSuperAdmin(context) || getActiveMembership(context)?.member_role === "owner";
}

export function hasPermission(context: PermissionContext, permission: PermissionCode): boolean {
  if (isTenantOwner(context)) return true;

  const membership = getActiveMembership(context);
  if (!membership?.role_id) return false;

  return context.permissionsByRoleId?.get(membership.role_id)?.includes(permission) ?? false;
}

export function canAccessProperty(context: PermissionContext, permission: PermissionCode): boolean {
  if (isTenantOwner(context)) return true;
  if (!hasPermission(context, permission)) return false;

  const membership = getActiveMembership(context);
  if (!membership || !context.propertyId) return false;

  return !membership.property_scope?.length || membership.property_scope.includes(context.propertyId);
}
