import type {
  FeatureFlagRow,
  PermissionCode,
  ProfileRow,
  TenantFeatureRow,
  TenantMemberRow,
  TenantRow,
  UserRole
} from "@hospedex/types";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

export type AuthContext = {
  userId: string;
  profile: ProfileRow;
  tenant: TenantRow | null;
  role: UserRole;
  memberships: TenantMemberRow[];
  permissions: PermissionCode[];
  featureFlags: Array<FeatureFlagRow & { enabled: boolean }>;
};

export function getRoleHomePath(role: UserRole): string {
  if (role === "super_admin") return "/super-admin";
  if (role === "owner" || role === "staff") return "/";
  return "/sem-acesso";
}

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();

  if (claims.error) return null;

  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;

  const { data: membershipsData } = await supabase
    .from("tenant_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<TenantMemberRow[]>();

  const memberships = membershipsData ?? [];
  const activeMembership = memberships[0] ?? null;
  const { data: ownedTenant } = !activeMembership
    ? await supabase.from("tenants").select("*").eq("owner_id", userId).maybeSingle<TenantRow>()
    : { data: null };
  const tenantId = activeMembership?.tenant_id ?? ownedTenant?.id;

  const { data: tenant } =
    tenantId && !ownedTenant
      ? await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle<TenantRow>()
      : { data: ownedTenant };

  const role = resolveRole(profile, activeMembership, ownedTenant);
  const permissions = await loadPermissions(activeMembership?.role_id ?? null);
  const featureFlags = tenantId ? await loadFeatureFlags(tenantId) : [];

  return {
    userId,
    profile,
    tenant,
    role,
    memberships,
    permissions,
    featureFlags
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (context.role === "guest") redirect("/sem-acesso");
  return context;
}

export async function requireSuperAdmin(): Promise<AuthContext> {
  const context = await requireAuth();
  if (context.role !== "super_admin") redirect("/");
  return context;
}

function resolveRole(
  profile: ProfileRow,
  membership: TenantMemberRow | null,
  ownedTenant: TenantRow | null
): UserRole {
  if (profile.platform_role === "super_admin") return "super_admin";
  if (ownedTenant) return "owner";
  if (membership?.member_role === "owner") return "owner";
  if (membership?.member_role === "staff") return "staff";
  return "guest";
}

async function loadPermissions(roleId: string | null): Promise<PermissionCode[]> {
  if (!roleId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permissions(code)")
    .eq("role_id", roleId)
    .returns<Array<{ permissions: { code: PermissionCode } | null }>>();

  return (data ?? []).flatMap((row) =>
    row.permissions?.code ? [row.permissions.code] : []
  );
}

async function loadFeatureFlags(tenantId: string) {
  const supabase = await createClient();
  const { data: flagsData } = await supabase
    .from("feature_flags")
    .select("*")
    .returns<FeatureFlagRow[]>();

  const { data: tenantFeaturesData } = await supabase
    .from("tenant_features")
    .select("*")
    .eq("tenant_id", tenantId)
    .returns<TenantFeatureRow[]>();

  const flags = flagsData ?? [];
  const tenantFeatures = tenantFeaturesData ?? [];

  return flags.map((flag) => ({
    ...flag,
    enabled:
      tenantFeatures.find((tenantFeature) => tenantFeature.feature_flag_id === flag.id)
        ?.enabled ?? flag.default_enabled
  }));
}
