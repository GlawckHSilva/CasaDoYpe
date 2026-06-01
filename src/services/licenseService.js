export async function upsertLicenseRecord(supabase, license) {
  const { data, error } = await supabase.from('licenses').upsert(license).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteLicenseRecord(supabase, licenseId) {
  const { error } = await supabase.from('licenses').delete().eq('id', licenseId);
  if (error) throw error;
}
