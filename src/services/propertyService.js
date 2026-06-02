export async function createPropertyRecord(supabase, propertyPayload) {
  const { id, ...insertable } = propertyPayload;
  const { data, error } = await supabase.from('properties').insert(insertable).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Nenhuma casa foi criada; verifique a licenca e as policies RLS.');
  return data;
}

export async function updatePropertyRecord(supabase, property, ownerId) {
  let query = supabase.from('properties').update(property).eq('id', property.id).select().maybeSingle();
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error('Nenhuma casa foi atualizada; verifique a licenca e as policies RLS.');
  return data;
}

export async function deletePropertyRecord(supabase, propertyId, ownerId) {
  let query = supabase.from('properties').delete().eq('id', propertyId);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { error } = await query;
  if (error) throw error;
}
