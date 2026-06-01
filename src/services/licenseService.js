export async function upsertLicenseRecord(supabase, license) {
  const { data, error } = await supabase.from('licenses').upsert(license).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteLicenseRecord(supabase, licenseId) {
  const { error } = await supabase.from('licenses').delete().eq('id', licenseId);
  if (error) throw error;
}

export function getOwnerPanelAccessState({ role, license, licenseIsValid }) {
  if (role === 'super_admin') return { blocked: false, reason: 'super_admin' };
  if (role !== 'proprietario') return { blocked: false, reason: 'not_owner' };
  if (!license) return { blocked: true, reason: 'waiting_license' };
  if (!licenseIsValid) return { blocked: true, reason: 'invalid_license' };
  return { blocked: false, reason: 'active_license' };
}

export function getOwnerPropertyLimitState({ role, license, licenseIsValid, properties = [], ownerId }) {
  if (role === 'super_admin') {
    return { canCreate: true, reason: 'super_admin', currentProperties: 0, propertyLimit: Infinity };
  }

  if (role !== 'proprietario') {
    return { canCreate: false, reason: 'not_owner', currentProperties: 0, propertyLimit: 0 };
  }

  if (!license || !licenseIsValid) {
    return { canCreate: false, reason: 'invalid_license', currentProperties: 0, propertyLimit: 0 };
  }

  const propertyLimit = Math.max(0, Number(license.property_limit || 1));
  const currentProperties = properties.filter((property) => {
    if (!property || property.id === 'empty-owner-property' || property.id === 'empty-property') return false;
    if (property.owner_id !== ownerId) return false;
    if (property.active === false || property.deleted_at) return false;
    return true;
  }).length;

  return {
    canCreate: currentProperties < propertyLimit,
    reason: currentProperties < propertyLimit ? 'below_limit' : 'limit_reached',
    currentProperties,
    propertyLimit,
  };
}
