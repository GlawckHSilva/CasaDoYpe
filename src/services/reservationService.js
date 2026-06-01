export async function createReservationRecord(supabase, reservation) {
  const { data, error } = await supabase.from('reservations').insert(reservation).select().maybeSingle();
  if (error) throw error;
  return data;
}
