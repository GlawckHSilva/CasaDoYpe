import type { FeatureFlagKey } from "@hospedex/types";

import { featureFlagCatalog } from "./catalog";

type FlagMap = Partial<Record<FeatureFlagKey, boolean>>;

export type FeatureFlagEvaluationInput = {
  entitlements?: FlagMap;
  ownerSettings?: FlagMap;
  superAdminOverrides?: FlagMap;
};

export function isFeatureEnabled(
  key: FeatureFlagKey,
  input: FeatureFlagEvaluationInput = {}
): boolean {
  const definition = featureFlagCatalog.find((flag) => flag.key === key);

  if (!definition) {
    return false;
  }

  if (input.superAdminOverrides?.[key] === false) {
    return false;
  }

  const entitlementValue = input.entitlements?.[key] ?? definition.defaultEnabled;

  if (!entitlementValue) {
    return false;
  }

  if (!definition.ownerConfigurable) {
    return entitlementValue;
  }

  return input.ownerSettings?.[key] ?? entitlementValue;
}
