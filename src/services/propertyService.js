export async function createPropertyRecord(supabase, propertyPayload) {
  const { id, ...insertable } = propertyPayload;
  const { data, error } = await supabase.from('properties').insert(insertable).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePropertyRecord(supabase, property, ownerId) {
  let query = supabase.from('properties').update(property).eq('id', property.id);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { error } = await query;
  if (error) throw error;
  return property;
}

export async function deletePropertyRecord(supabase, propertyId, ownerId) {
  let query = supabase.from('properties').delete().eq('id', propertyId);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { error } = await query;
  if (error) throw error;
}
