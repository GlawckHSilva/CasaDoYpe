import type { FeatureFlagDefinition } from "@hospedex/types";

export const featureFlagCatalog = [
  {
    key: "marketplace_visibility",
    module: "marketplace",
    defaultEnabled: true,
    ownerConfigurable: true
  },
  {
    key: "manual_approval",
    module: "reservations",
    defaultEnabled: true,
    ownerConfigurable: true
  },
  {
    key: "auto_booking",
    module: "reservations",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "payments",
    module: "finance",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "gateway_primary",
    module: "finance",
    defaultEnabled: false,
    ownerConfigurable: false,
    superAdminOnly: true
  },
  {
    key: "extra_services",
    module: "marketplace",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "reviews",
    module: "marketplace",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "regional_guide",
    module: "marketplace",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "advanced_rates",
    module: "advanced_rates",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "multi_unit",
    module: "multi_unit",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "ics_sync",
    module: "calendar",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "cleaning",
    module: "cleaning",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "inventory",
    module: "inventory",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "staff",
    module: "staff",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "crm",
    module: "crm",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "automations",
    module: "automations",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "ai_assistant",
    module: "ai",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "ai_pricing",
    module: "ai",
    defaultEnabled: false,
    ownerConfigurable: true
  },
  {
    key: "reports",
    module: "reports",
    defaultEnabled: false,
    ownerConfigurable: true
  }
] as const satisfies readonly FeatureFlagDefinition[];
