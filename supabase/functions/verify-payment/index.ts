import {
  computeSplitAmounts,
  corsHeaders,
  getAuthenticatedUser,
  getServiceClient,
  jsonResponse,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      return jsonResponse({ error: 'PAYSTACK_SECRET_KEY is not configured.' }, 503);
    }

    const { reference } = await req.json();
    if (!reference) return jsonResponse({ error: 'Payment reference is required.' }, 400);

    const supabase = getServiceClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_reference', reference)
      .single();

    if (!booking) return jsonResponse({ error: 'Booking not found.' }, 404);
    if (booking.student_id !== user.id) {
      return jsonResponse({ error: 'Forbidden: booking belongs to another student.' }, 403);
    }

    // Idempotent check if already verified
    if (booking.payment_status === 'held' || booking.status === 'awaiting_inspection') {
      return jsonResponse({ verified: true, duplicate: true, booking });
    }

    // Server-side verification directly against Paystack API (never trust client success callbacks)
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const psData = await psRes.json();

    if (!psRes.ok || !psData?.status || psData?.data?.status !== 'success') {
      await supabase
        .from('bookings')
        .update({ status: 'payment_failed', payment_status: 'failed' })
        .eq('id', booking.id);
      return jsonResponse({ verified: false, error: 'Paystack transaction verification failed.' }, 400);
    }

    const expectedAmount = Number(booking.total_booking_fee_kobo);
    if (Number(psData.data.amount) !== expectedAmount) {
      return jsonResponse({ error: 'Amount mismatch during Paystack verification.' }, 400);
    }

    const paidAt = psData.data.paid_at || new Date().toISOString();
    const splitAt = new Date(new Date(paidAt).getTime() + 48 * 60 * 60 * 1000).toISOString();
    const split = computeSplitAmounts(Number(booking.agent_fee_kobo));

    await supabase.from('payments').upsert(
      {
        booking_id: booking.id,
        paystack_reference: reference,
        amount_kobo: expectedAmount,
        status: 'held',
        agent_share_kobo: split.agentShareKobo,
        sug_share_kobo: split.sugShareKobo,
        platform_agent_share_kobo: split.platformAgentShareKobo,
        platform_inspection_fee_kobo: split.platformInspectionFeeKobo,
        paid_at: paidAt,
        split_at: splitAt,
      },
      { onConflict: 'paystack_reference' }
    );

    const { data: updatedBooking } = await supabase
      .from('bookings')
      .update({
        status: 'awaiting_inspection',
        payment_status: 'held',
        paid_at: paidAt,
        split_at: splitAt,
      })
      .eq('id', booking.id)
      .select('*')
      .single();

    return jsonResponse({
      verified: true,
      booking: updatedBooking,
      split_at: splitAt,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Verification failed.' }, 500);
  }
});
