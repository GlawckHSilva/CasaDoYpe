export async function createReservationRecord(supabase, reservation) {
  const { data, error } = await supabase.from('reservations').insert(reservation).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Nenhuma reserva foi criada. Verifique as policies RLS do Supabase.');
  return data;
}
