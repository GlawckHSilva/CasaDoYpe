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
