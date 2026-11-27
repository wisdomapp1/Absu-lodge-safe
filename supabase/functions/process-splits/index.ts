import {
  computeSplitAmounts,
  corsHeaders,
  getAuthenticatedUser,
  getServerRole,
  getServiceClient,
  jsonResponse,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Allow either scheduled cron header with service key OR authenticated Super Admin trigger
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isCron = Boolean(cronSecret && req.headers.get('x-cron-secret') === cronSecret);
    const supabase = getServiceClient();

    if (!isCron) {
      const user = await getAuthenticatedUser(req);
      if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);
      const role = await getServerRole(supabase, user.id);
      if (role !== 'super_admin') {
        return jsonResponse({ error: 'Forbidden: Only Super Admin can manually trigger settlements.' }, 403);
      }
    }

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      return jsonResponse({ error: 'PAYSTACK_SECRET_KEY is required to initiate Paystack transfers.' }, 503);
    }

    const nowIso = new Date().toISOString();

    // 1. Find eligible held bookings past split_at with no pending/approved refund
    const { data: eligibleBookings, error: queryErr } = await supabase
      .from('bookings')
      .select('*, payments(*), agents(*, agent_payout_accounts(*))')
      .in('status', ['confirmed', 'awaiting_inspection'])
      .eq('payment_status', 'held')
      .eq('refund_locked', false)
      .lte('split_at', nowIso);

    if (queryErr) return jsonResponse({ error: queryErr.message }, 500);

    const processed: string[] = [];
    for (const bk of eligibleBookings || []) {
      // Ensure no duplicate settlement or refund
      const { data: refunds } = await supabase
        .from('refunds')
        .select('id, status')
        .eq('booking_id', bk.id)
        .limit(1);
      if (refunds && refunds.length > 0) continue;

      const { data: existingSettlements } = await supabase
        .from('settlements')
        .select('id, status')
        .eq('booking_id', bk.id);
      if (existingSettlements && existingSettlements.length > 0) continue;

      const split = computeSplitAmounts(Number(bk.agent_fee_kobo));
      const agentRecipientCode = bk.agents?.agent_payout_accounts?.[0]?.paystack_recipient_code;
      const sugRecipientCode = Deno.env.get('SUG_PAYSTACK_RECIPIENT_CODE');
      const platformRecipientCode = Deno.env.get('PLATFORM_PAYSTACK_RECIPIENT_CODE');

      const transfers = [
        { recipient_type: 'agent', recipient_code: agentRecipientCode, amount: split.agentShareKobo },
        { recipient_type: 'sug', recipient_code: sugRecipientCode, amount: split.sugShareKobo },
        { recipient_type: 'platform', recipient_code: platformRecipientCode, amount: split.platformTotalKobo },
      ];

      for (const tr of transfers) {
        if (!tr.recipient_code || tr.amount <= 0) {
          await supabase.from('settlements').insert({
            booking_id: bk.id,
            recipient_type: tr.recipient_type,
            amount_kobo: tr.amount,
            status: 'failed',
            retry_count: 0,
            failure_reason: `Missing Paystack recipient_code for ${tr.recipient_type}.`,
          });
          continue;
        }

        const reference = `ABSU-STL-${bk.id.slice(0, 8)}-${tr.recipient_type}`;
        const psRes = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'balance',
            amount: tr.amount,
            recipient: tr.recipient_code,
            reference,
            reason: `ABSU LodgeSafe 48h settlement (${bk.booking_reference})`,
          }),
        });
        const psData = await psRes.json();

        // NEVER mark transfer successful just because API accepted it — keep as processing until webhook confirms!
        await supabase.from('settlements').insert({
          booking_id: bk.id,
          recipient_type: tr.recipient_type,
          amount_kobo: tr.amount,
          transfer_code: psData?.data?.transfer_code || null,
          status: psRes.ok && psData?.status ? 'processing' : 'failed',
          retry_count: 0,
          failure_reason: psRes.ok ? null : psData?.message || 'Paystack transfer initiation failed.',
        });
      }

      await supabase
        .from('bookings')
        .update({ status: 'settlement_processing', payment_status: 'settlement_processing' })
        .eq('id', bk.id);
      processed.push(bk.booking_reference);
    }

    return jsonResponse({ processedCount: processed.length, processed });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Settlement batch failed.' }, 500);
  }
});
