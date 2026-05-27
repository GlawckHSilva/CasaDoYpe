const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const to = body.to || Deno.env.get('COMMERCIAL_EMAIL') || 'hospedex1@gmail.com';

    if (!resendApiKey) {
      return Response.json({ ok: false, reason: 'RESEND_API_KEY not configured' }, { headers: corsHeaders });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('SUGGESTION_FROM_EMAIL') || 'HospedeX <onboarding@resend.dev>',
        to,
        subject: `Sugestão recebida${body.propertyName ? ` - ${body.propertyName}` : ''}`,
        text: [`Nome: ${body.name || '-'}`, `E-mail: ${body.email || '-'}`, '', body.message || ''].join('\n'),
      }),
    });

    const data = await response.json();
    return Response.json({ ok: response.ok, data }, { headers: corsHeaders, status: response.ok ? 200 : 400 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { headers: corsHeaders, status: 400 });
  }
});
