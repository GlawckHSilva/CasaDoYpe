export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Timestamp = string;
export type UUID = string;

export type TenantStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type PlatformRole = "user" | "super_admin";
export type TenantMemberRole = "owner" | "staff";
export type TenantMemberStatus = "invited" | "active" | "disabled";
export type PropertyStatus = "draft" | "published" | "paused" | "archived";
export type PropertyType = "seasonal_home" | "inn" | "small_hotel";
export type ReservationStatus = "draft" | "pending" | "confirmed" | "cancelled" | "completed";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "pending" | "paid" | "cancelled" | "refunded";

export type ProfileRow = {
  id: UUID;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  platform_role: PlatformRole;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
};

export type TenantRow = {
  id: UUID;
  owner_id: UUID;
  name: string;
  slug: string;
  status: TenantStatus;
  default_property_type: PropertyType | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
};

export type TenantMemberRow = {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  role_id: UUID | null;
  member_role: TenantMemberRole;
  status: TenantMemberStatus;
  property_scope: UUID[] | null;
  invited_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PermissionRow = {
  id: UUID;
  code: PermissionCode;
  name: string;
  module: string;
  description: string | null;
  created_at: Timestamp;
};

export type PermissionCode =
  | "tenants.manage"
  | "members.manage"
  | "roles.manage"
  | "features.manage"
  | "properties.read"
  | "properties.manage"
  | "reservations.read"
  | "reservations.manage"
  | "finance.read"
  | "finance.manage"
  | "audit.read";

export type RoleRow = {
  id: UUID;
  tenant_id: UUID | null;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type FeatureFlagRow = {
  id: UUID;
  key: string;
  module: string;
  description: string | null;
  default_enabled: boolean;
  owner_configurable: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type TenantFeatureRow = {
  id: UUID;
  tenant_id: UUID;
  feature_flag_id: UUID;
  enabled: boolean;
  configured_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PlanRow = {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_properties: number;
  max_units: number;
  status: "draft" | "active" | "archived";
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type LicenseRow = {
  id: UUID;
  tenant_id: UUID;
  owner_id: UUID;
  subscription_id: UUID | null;
  license_key: string;
  status: "trial" | "active" | "expired" | "suspended" | "cancelled";
  starts_at: string;
  expires_at: string | null;
  limits: JsonValue;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PropertyRow = {
  id: UUID;
  tenant_id: UUID;
  owner_id: UUID;
  name: string;
  slug: string;
  property_type: PropertyType;
  status: PropertyStatus;
  headline: string | null;
  description: string | null;
  address: JsonValue;
  timezone: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
};

export type UnitRow = {
  id: UUID;
  tenant_id: UUID;
  property_id: UUID;
  unit_category_id: UUID | null;
  code: string;
  name: string;
  status: "active" | "inactive" | "maintenance";
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ReservationRow = {
  id: UUID;
  tenant_id: UUID;
  property_id: UUID;
  unit_id: UUID | null;
  owner_id: UUID;
  code: string;
  status: ReservationStatus;
  source: "manual" | "marketplace" | "direct" | "external";
  check_in: string;
  check_out: string;
  guests_count: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type FinancialAccountRow = {
  id: UUID;
  tenant_id: UUID;
  owner_id: UUID;
  property_id: UUID | null;
  name: string;
  account_type: "cash" | "bank" | "gateway" | "other";
  currency: string;
  status: "active" | "inactive";
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type TransactionRow = {
  id: UUID;
  tenant_id: UUID;
  financial_account_id: UUID;
  property_id: UUID | null;
  reservation_id: UUID | null;
  expense_category_id: UUID | null;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_at: Timestamp | null;
  description: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type AuditLogRow = {
  id: UUID;
  tenant_id: UUID | null;
  actor_id: UUID | null;
  action: string;
  entity_table: string | null;
  entity_id: UUID | null;
  metadata: JsonValue;
  created_at: Timestamp;
};
