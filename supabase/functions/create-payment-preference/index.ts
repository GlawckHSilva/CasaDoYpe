const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!accessToken || !supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Payment provider is not configured.' }, 500);
    }

    const { reservationId } = await req.json();
    if (!reservationId) {
      return json({ error: 'Invalid reservation payment request.' }, 400);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userJwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!userJwt) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${userJwt}`,
      },
    });
    if (!userResponse.ok) {
      return json({ error: 'Invalid user session.' }, 401);
    }
    const user = await userResponse.json();
    const profile = await restSingle(
      supabaseUrl,
      serviceRoleKey,
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role`,
    );
    const reservation = await restSingle(
      supabaseUrl,
      serviceRoleKey,
      `reservations?id=eq.${encodeURIComponent(reservationId)}&select=id,property_id,guest_email,total_amount,installments`,
    );
    if (!reservation) {
      return json({ error: 'Reservation not found.' }, 404);
    }
    const property = await restSingle(
      supabaseUrl,
      serviceRoleKey,
      `properties?id=eq.${encodeURIComponent(reservation.property_id)}&select=id,name,owner_id`,
    );
    const canManageReservation = profile?.role === 'super_admin' || property?.owner_id === user.id;
    if (!canManageReservation) {
      return json({ error: 'Not allowed to create payment for this reservation.' }, 403);
    }

    const amount = Number(reservation.total_amount || 0);
    if (amount <= 0) {
      return json({ error: 'Invalid reservation amount.' }, 400);
    }

    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: `Reserva ${property?.name || 'Casa'}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: amount,
          },
        ],
        payer: reservation.guest_email ? { email: reservation.guest_email } : undefined,
        external_reference: reservationId,
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: Number(reservation.installments || 1),
        },
        back_urls: {
          success: `${req.headers.get('origin') || ''}/#reserva`,
          pending: `${req.headers.get('origin') || ''}/#reserva`,
          failure: `${req.headers.get('origin') || ''}/#reserva`,
        },
        auto_return: 'approved',
      }),
    });

    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok) {
      return json({ error: preference.message || 'Could not create payment preference.' }, 500);
    }

    const paymentUrl = preference.init_point || preference.sandbox_init_point;

    await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${reservationId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ payment_url: paymentUrl }),
    });

    return json({ paymentUrl, preferenceId: preference.id });
  } catch (_error) {
    return json({ error: 'Unexpected payment error.' }, 500);
  }
});

async function restSingle(supabaseUrl: string, serviceRoleKey: string, path: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
