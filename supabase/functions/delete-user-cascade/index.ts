import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Missing Supabase environment variables.' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: requesterData, error: requesterError } = await userClient.auth.getUser();
  if (requesterError || !requesterData.user) return json({ error: 'Unauthorized.' }, 401);

  const { data: requesterProfile } = await adminClient
    .from('profiles')
    .select('role,email')
    .eq('id', requesterData.user.id)
    .maybeSingle();

  if (requesterProfile?.role !== 'super_admin') {
    return json({ error: 'Only super admins can delete users.' }, 403);
  }

  const { userId } = await req.json();
  if (!userId || userId === requesterData.user.id) {
    return json({ error: 'Invalid user id.' }, 400);
  }

  const { data: ownedProperties } = await adminClient.from('properties').select('id').eq('owner_id', userId);
  const propertyIds = (ownedProperties || []).map((property) => property.id);

  if (propertyIds.length) {
    const { data: photoRows } = await adminClient.from('property_photos').select('storage_path').in('property_id', propertyIds);
    const storagePaths = (photoRows || []).map((photo) => photo.storage_path).filter(Boolean);
    if (storagePaths.length) {
      await adminClient.storage.from('property-photos').remove(storagePaths);
    }
  }

  await adminClient.from('payments').delete().eq('user_id', userId);
  await adminClient.from('vouchers').delete().eq('user_id', userId);
  await adminClient.from('suggestions').delete().eq('user_id', userId);
  await adminClient.from('support_tickets').delete().eq('user_id', userId);
  await adminClient.from('licenses').delete().eq('owner_id', userId);
  await adminClient.from('payment_settings').delete().eq('owner_id', userId);
  await adminClient.from('reservations').delete().eq('guest_user_id', userId);
  if (propertyIds.length) await adminClient.from('properties').delete().in('id', propertyIds);
  await adminClient.from('profiles').delete().eq('id', userId);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  await adminClient.from('admin_logs').insert({
    actor_email: requesterProfile.email,
    action: 'super_admin_user_deleted',
    details: { user_id: userId },
  });

  return json({ ok: true });
});
