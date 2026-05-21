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

    const { reservationId, propertyName, payerEmail, amount } = await req.json();
    if (!reservationId || !amount || Number(amount) <= 0) {
      return json({ error: 'Invalid reservation payment request.' }, 400);
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
            title: `Reserva ${propertyName || 'Casa'}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(amount),
          },
        ],
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: reservationId,
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 6,
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
