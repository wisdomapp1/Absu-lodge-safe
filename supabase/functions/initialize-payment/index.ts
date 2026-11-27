import {
  computeSplitAmounts,
  corsHeaders,
  getAuthenticatedUser,
  getServiceClient,
  INSPECTION_FEE_KOBO,
  jsonResponse,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      return jsonResponse(
        { error: 'PAYSTACK_SECRET_KEY is not configured in Supabase Edge Function secrets.' },
        503
      );
    }

    const body = await req.json();
    const { lodge_id, agreed_policy } = body || {};
    if (!agreed_policy) {
      return jsonResponse({ error: 'You must agree to the mandatory booking policy before payment.' }, 400);
    }
    if (!lodge_id) {
      return jsonResponse({ error: 'lodge_id is required.' }, 400);
    }

    const supabase = getServiceClient();
    const { data: lodge, error: lodgeErr } = await supabase
      .from('properties')
      .select('id, title, agent_id, agent_fee_kobo, verification_status, availability_status, available_rooms')
      .eq('id', lodge_id)
      .single();

    if (lodgeErr || !lodge) return jsonResponse({ error: 'Lodge not found.' }, 404);
    if (lodge.verification_status !== 'approved' && lodge.verification_status !== 'SUG Verified') {
      return jsonResponse({ error: 'Only approved lodges can be booked.' }, 400);
    }
    if (Number(lodge.available_rooms ?? 1) <= 0 || lodge.availability_status === 'Unavailable') {
      return jsonResponse({ error: 'Lodge has no available units.' }, 409);
    }

    const split = computeSplitAmounts(Number(lodge.agent_fee_kobo));
    const reference = `ABSU-PAY-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const bookingId = crypto.randomUUID();

    // Create pending booking BEFORE Paystack initialization (prevents orphaned charges)
    const { error: insertErr } = await supabase.from('bookings').insert({
      id: bookingId,
      booking_reference: reference,
      property_id: lodge.id,
      student_id: user.id,
      agent_id: lodge.agent_id,
      agent_fee_kobo: split.agentFeeKobo,
      inspection_fee_kobo: INSPECTION_FEE_KOBO,
      total_booking_fee_kobo: split.totalBookingFeeKobo,
      status: 'pending_payment',
      payment_status: 'unpaid',
    });
    if (insertErr) return jsonResponse({ error: insertErr.message }, 500);

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: split.totalBookingFeeKobo,
        reference,
        metadata: {
          lodge_id: lodge.id,
          student_id: user.id,
          agent_id: lodge.agent_id,
          agent_fee: split.agentFeeKobo,
          inspection_fee: INSPECTION_FEE_KOBO,
          booking_id: bookingId,
        },
      }),
    });

    const psData = await psRes.json();
    if (!psRes.ok || !psData?.status) {
      return jsonResponse({ error: psData?.message || 'Paystack initialization failed.' }, 502);
    }

    return jsonResponse({
      booking_id: bookingId,
      reference,
      amount_kobo: split.totalBookingFeeKobo,
      authorization_url: psData.data.authorization_url,
      access_code: psData.data.access_code,
      metadata: {
        lodge_id: lodge.id,
        student_id: user.id,
        agent_id: lodge.agent_id,
        agent_fee: split.agentFeeKobo,
        inspection_fee: INSPECTION_FEE_KOBO,
        booking_id: bookingId,
      },
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Unexpected error initializing payment.' }, 500);
  }
});
