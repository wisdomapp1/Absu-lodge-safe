import {
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

    const { booking_id, reason, description } = await req.json();
    if (!booking_id || !reason) {
      return jsonResponse({ error: 'booking_id and reason are required.' }, 400);
    }

    const supabase = getServiceClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (!booking) return jsonResponse({ error: 'Booking not found.' }, 404);
    if (booking.student_id !== user.id) {
      return jsonResponse({ error: 'Forbidden: you can only request refunds for your own bookings.' }, 403);
    }
    if (['settled', 'refunded'].includes(booking.status)) {
      return jsonResponse({ error: 'Cannot request refund on a settled or refunded booking.' }, 400);
    }

    // Prevent duplicate refund
    const { data: existingRefund } = await supabase
      .from('refunds')
      .select('id')
      .eq('booking_id', booking.id)
      .limit(1);
    if (existingRefund && existingRefund.length > 0) {
      return jsonResponse({ error: 'A refund request already exists for this booking.' }, 409);
    }

    // Lock booking immediately against settlement
    await supabase
      .from('bookings')
      .update({ refund_locked: true, status: 'dispute_requested', payment_status: 'refund_pending' })
      .eq('id', booking.id);

    const { data: refundRow, error: refErr } = await supabase
      .from('refunds')
      .insert({
        booking_id: booking.id,
        student_id: user.id,
        amount_kobo: Number(booking.total_booking_fee_kobo),
        reason,
        status: 'pending',
      })
      .select('*')
      .single();

    if (refErr) return jsonResponse({ error: refErr.message }, 500);

    await supabase.from('disputes').insert({
      booking_id: booking.id,
      student_id: user.id,
      agent_id: booking.agent_id,
      reason,
      description: description || reason,
      status: 'open',
    });

    return jsonResponse({ refund: refundRow, settlement_locked: true });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Failed to submit refund request.' }, 500);
  }
});
