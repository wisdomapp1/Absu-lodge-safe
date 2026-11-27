import {
  computeSplitAmounts,
  corsHeaders,
  getServiceClient,
  jsonResponse,
  verifyPaystackHmac,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const sig = req.headers.get('x-paystack-signature');
    const valid = await verifyPaystackHmac(rawBody, sig);
    if (!valid) {
      return jsonResponse({ error: 'Invalid Paystack webhook signature.' }, 401);
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event?.event || '';
    const ref: string = event?.data?.reference || event?.data?.transaction_reference || '';
    const webhookId = `${eventType}:${event?.data?.id || ref}`;

    const supabase = getServiceClient();

    // Idempotency guard
    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('webhook_id', webhookId)
      .limit(1);
    if (existing && existing.length > 0) {
      return jsonResponse({ received: true, duplicate_ignored: true });
    }

    await supabase.from('payment_events').insert({
      webhook_id: webhookId,
      event_type: eventType,
      reference: ref,
      payload: event,
      signature_valid: true,
    });

    if (eventType === 'charge.success' && ref) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_reference', ref)
        .single();
      if (booking && booking.payment_status === 'unpaid') {
        const paidAt = event?.data?.paid_at || new Date().toISOString();
        const splitAt = new Date(new Date(paidAt).getTime() + 48 * 60 * 60 * 1000).toISOString();
        const split = computeSplitAmounts(Number(booking.agent_fee_kobo));

        await supabase.from('payments').upsert(
          {
            booking_id: booking.id,
            paystack_reference: ref,
            amount_kobo: Number(event?.data?.amount || booking.total_booking_fee_kobo),
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
        await supabase
          .from('bookings')
          .update({ status: 'awaiting_inspection', payment_status: 'held', paid_at: paidAt, split_at: splitAt })
          .eq('id', booking.id);
      }
    } else if (eventType === 'transfer.success' && event?.data?.transfer_code) {
      await supabase
        .from('settlements')
        .update({ status: 'successful', updated_at: new Date().toISOString() })
        .eq('transfer_code', event.data.transfer_code);
    } else if ((eventType === 'transfer.failed' || eventType === 'transfer.reversed') && event?.data?.transfer_code) {
      await supabase
        .from('settlements')
        .update({
          status: eventType === 'transfer.reversed' ? 'reversed' : 'failed',
          failure_reason: event?.data?.reason || eventType,
          updated_at: new Date().toISOString(),
        })
        .eq('transfer_code', event.data.transfer_code);
    } else if (eventType === 'refund.processed' && ref) {
      await supabase
        .from('refunds')
        .update({ status: 'processed', updated_at: new Date().toISOString() })
        .eq('paystack_refund_ref', ref);
      await supabase
        .from('bookings')
        .update({ status: 'refunded', payment_status: 'refunded' })
        .eq('booking_reference', ref);
    } else if (eventType === 'refund.failed' && ref) {
      await supabase
        .from('refunds')
        .update({
          status: 'failed',
          failure_reason: event?.data?.status_description || 'Refund failed at Paystack',
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_refund_ref', ref);
    }

    return jsonResponse({ received: true });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Webhook processing error.' }, 500);
  }
});
