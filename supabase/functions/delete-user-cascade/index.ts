import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const allowedOrigins = [
  'https://casa-do-ype.vercel.app',
  'https://hospedex.vercel.app',
  'https://hospedex.com.br',
  'https://www.hospedex.com.br',
  'http://localhost:5173',
  'http://localhost:5185',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5185',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  const allowedOrigin = allowedOrigins.includes(origin) || isVercelPreview ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'content-type': 'application/json' },
  });
}

function jsonError(req: Request, message: string, status: number, code: string, detail?: unknown) {
  return json(req, { ok: false, error: message, code, detail }, status);
}

function getBearerToken(req: Request) {
  return (req.headers.get('authorization') || req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message || '';
  return error?.code === '42P01' || error?.code === '42703' || /relation .* does not exist|table .* does not exist|column .* does not exist/i.test(message);
}

function buildDbError(table: string, error: { message?: string; code?: string; details?: string } | null) {
  return {
    message: `Erro interno ao excluir dados de ${table}.`,
    detail: error?.details || error?.message || null,
    code: error?.code || null,
  };
}

function isMissingStorageBucketError(error: { message?: string; statusCode?: string | number } | null | undefined) {
  return /bucket.*not found|not found/i.test(error?.message || '') || String(error?.statusCode || '') === '404';
}

async function deleteRows(
  req: Request,
  query: PromiseLike<{ error: { message?: string; code?: string; details?: string } | null }>,
  table: string,
  optional = false,
) {
  const { error } = await query;
  if (!error) return null;
  if (optional && isMissingRelationError(error)) return null;

  const dbError = buildDbError(table, error);
  return jsonError(req, dbError.message, 500, `delete_${table}_failed`, dbError);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  if (req.method !== 'POST') {
    return jsonError(req, 'Metodo nao permitido.', 405, 'method_not_allowed');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl) {
      return jsonError(req, 'Edge Function nao configurada: SUPABASE_URL ausente.', 500, 'missing_supabase_url');
    }
    if (!serviceRoleKey) {
      return jsonError(req, 'Service role nao configurada na Edge Function.', 500, 'missing_service_role');
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonError(req, 'Token de sessao nao enviado para a Edge Function.', 401, 'missing_auth_token');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(token);
    if (requesterError || !requesterData.user) {
      return jsonError(req, 'Usuario autenticado nao encontrado.', 401, 'invalid_session', requesterError?.message);
    }

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from('profiles')
      .select('id,email,role')
      .eq('id', requesterData.user.id)
      .maybeSingle();

    if (requesterProfileError) {
      return jsonError(req, 'Erro interno ao validar perfil super_admin.', 500, 'requester_profile_error', requesterProfileError.message);
    }
    if (!requesterProfile) {
      return jsonError(req, 'Perfil super_admin nao encontrado.', 403, 'requester_profile_missing');
    }
    if (String(requesterProfile.role || '').toLowerCase() !== 'super_admin') {
      return jsonError(req, 'Voce nao tem permissao para excluir usuarios.', 403, 'not_super_admin');
    }

    let body: { userId?: string; user_id?: string; email?: string };
    try {
      body = await req.json();
    } catch (_error) {
      return jsonError(req, 'Requisicao invalida.', 400, 'invalid_json');
    }

    const userId = String(body.userId || body.user_id || '').trim();
    if (!userId) {
      return jsonError(req, 'Usuario nao informado.', 400, 'missing_user_id');
    }
    if (userId === requesterData.user.id) {
      return jsonError(req, 'Voce nao pode excluir o proprio usuario logado.', 400, 'cannot_delete_self');
    }

    const { data: targetAuthData, error: targetAuthError } = await adminClient.auth.admin.getUserById(userId);
    if (targetAuthError || !targetAuthData?.user) {
      return jsonError(req, 'Usuario nao encontrado.', 404, 'user_not_found', targetAuthError?.message);
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id,email,role')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfileError) {
      return jsonError(req, 'Erro interno ao carregar o perfil do usuario.', 500, 'target_profile_error', targetProfileError.message);
    }

    const targetEmail = String(body.email || targetProfile?.email || targetAuthData.user.email || '').trim();

    const { data: ownedProperties, error: propertiesError } = await adminClient
      .from('properties')
      .select('id')
      .eq('owner_id', userId);

    if (propertiesError) {
      return jsonError(req, 'Erro interno ao carregar casas do usuario.', 500, 'properties_lookup_error', propertiesError.message);
    }

    const propertyIds = (ownedProperties || []).map((property) => property.id).filter(Boolean);

    const { data: ownedLicenses, error: licenseLookupError } = await adminClient
      .from('licenses')
      .select('id')
      .eq('owner_id', userId);

    if (licenseLookupError && !isMissingRelationError(licenseLookupError)) {
      return jsonError(req, 'Erro interno ao carregar licencas do usuario.', 500, 'licenses_lookup_error', licenseLookupError.message);
    }

    const licenseIds = (ownedLicenses || []).map((license) => license.id).filter(Boolean);
    if (licenseIds.length) {
      const licenseHistoryError = await deleteRows(
        req,
        adminClient.from('license_history').delete().in('license_id', licenseIds),
        'license_history',
        true,
      );
      if (licenseHistoryError) return licenseHistoryError;
    }

    if (propertyIds.length) {
      const { data: photoRows, error: photoLookupError } = await adminClient
        .from('property_photos')
        .select('storage_path')
        .in('property_id', propertyIds);

      if (photoLookupError && !isMissingRelationError(photoLookupError)) {
        return jsonError(req, 'Erro interno ao carregar fotos das casas.', 500, 'photos_lookup_error', photoLookupError.message);
      }

      const storagePaths = (photoRows || []).map((photo) => photo.storage_path).filter(Boolean);
      if (storagePaths.length) {
        const { error: storageError } = await adminClient.storage.from('property-photos').remove(storagePaths);
        if (storageError) {
          return jsonError(req, 'Erro interno ao remover fotos do Storage.', 500, 'storage_delete_error', storageError.message);
        }
      }

      const photoDeleteError = await deleteRows(
        req,
        adminClient.from('property_photos').delete().in('property_id', propertyIds),
        'property_photos',
        true,
      );
      if (photoDeleteError) return photoDeleteError;

      const cashDeleteError = await deleteRows(
        req,
        adminClient.from('cash_movements').delete().in('property_id', propertyIds),
        'cash_movements',
        true,
      );
      if (cashDeleteError) return cashDeleteError;

      const paymentSettingsByPropertyError = await deleteRows(
        req,
        adminClient.from('payment_settings').delete().in('property_id', propertyIds),
        'payment_settings',
        true,
      );
      if (paymentSettingsByPropertyError) return paymentSettingsByPropertyError;

      const reservationsByPropertyError = await deleteRows(
        req,
        adminClient.from('reservations').delete().in('property_id', propertyIds),
        'reservations',
        true,
      );
      if (reservationsByPropertyError) return reservationsByPropertyError;
    }

    const userScopedDeletes = [
      ['payments', adminClient.from('payments').delete().eq('user_id', userId), true],
      ['vouchers', adminClient.from('vouchers').delete().eq('user_id', userId), true],
      ['suggestions', adminClient.from('suggestions').delete().eq('user_id', userId), true],
      ['support_tickets', adminClient.from('support_tickets').delete().eq('user_id', userId), true],
      ['licenses', adminClient.from('licenses').delete().eq('owner_id', userId), true],
      ['payment_settings', adminClient.from('payment_settings').delete().eq('owner_id', userId), true],
      ['platform_financial_movements', adminClient.from('platform_financial_movements').delete().eq('owner_id', userId), true],
      ['reservations', adminClient.from('reservations').delete().eq('guest_user_id', userId), true],
    ] as const;

    for (const [table, query, optional] of userScopedDeletes) {
      const errorResponse = await deleteRows(req, query, table, optional);
      if (errorResponse) return errorResponse;
    }

    if (targetEmail) {
      const emailScopedDeletes = [
        ['suggestions', adminClient.from('suggestions').delete().eq('user_email', targetEmail), true],
        ['suggestions', adminClient.from('suggestions').delete().eq('email', targetEmail), true],
        ['support_tickets', adminClient.from('support_tickets').delete().eq('user_email', targetEmail), true],
        ['reservations', adminClient.from('reservations').delete().eq('guest_email', targetEmail), true],
      ] as const;

      for (const [table, query, optional] of emailScopedDeletes) {
        const errorResponse = await deleteRows(req, query, table, optional);
        if (errorResponse) return errorResponse;
      }
    }

    if (propertyIds.length) {
      const propertiesDeleteError = await deleteRows(
        req,
        adminClient.from('properties').delete().in('id', propertyIds),
        'properties',
      );
      if (propertiesDeleteError) return propertiesDeleteError;
    }

    const { data: avatarFiles, error: avatarListError } = await adminClient.storage
      .from('profile-avatars')
      .list(userId, { limit: 100 });
    if (avatarListError && !isMissingStorageBucketError(avatarListError)) {
      return jsonError(req, 'Erro interno ao carregar foto do perfil.', 500, 'avatar_lookup_error', avatarListError.message);
    }
    const avatarPaths = (avatarFiles || []).map((file) => `${userId}/${file.name}`).filter(Boolean);
    if (avatarPaths.length) {
      const { error: avatarDeleteError } = await adminClient.storage.from('profile-avatars').remove(avatarPaths);
      if (avatarDeleteError && !isMissingStorageBucketError(avatarDeleteError)) {
        return jsonError(req, 'Erro interno ao remover foto do perfil.', 500, 'avatar_storage_delete_error', avatarDeleteError.message);
      }
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return jsonError(req, 'Erro interno ao excluir usuario do Auth.', 500, 'auth_delete_failed', deleteAuthError.message);
    }

    const profileDeleteError = await deleteRows(
      req,
      adminClient.from('profiles').delete().eq('id', userId),
      'profiles',
      true,
    );
    if (profileDeleteError) return profileDeleteError;

    const { error: logError } = await adminClient.from('admin_logs').insert({
      actor_email: requesterProfile.email,
      action: 'super_admin_user_deleted',
      details: {
        user_id: userId,
        email: targetEmail,
        properties_deleted: propertyIds.length,
      },
    });
    if (logError && !isMissingRelationError(logError)) {
      console.error('Could not write admin log', logError);
    }

    return json(req, {
      ok: true,
      deleted_user_id: userId,
      deleted_email: targetEmail,
      properties_deleted: propertyIds.length,
    });
  } catch (error) {
    console.error('Unexpected delete-user-cascade error', error);
    return jsonError(req, 'Erro interno ao excluir usuario.', 500, 'unexpected_error', error instanceof Error ? error.message : error);
  }
});
