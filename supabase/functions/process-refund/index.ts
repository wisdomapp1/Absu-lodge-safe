import {
  corsHeaders,
  getAuthenticatedUser,
  getServerRole,
  getServiceClient,
  jsonResponse,
} from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);

    const supabase = getServiceClient();
    const role = await getServerRole(supabase, user.id);
    if (role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden: Only Super Admin can initiate Paystack refunds.' }, 403);
    }

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      return jsonResponse({ error: 'PAYSTACK_SECRET_KEY is not configured.' }, 503);
    }

    const { refund_id } = await req.json();
    const { data: refundRow } = await supabase
      .from('refunds')
      .select('*, bookings(*)')
      .eq('id', refund_id)
      .single();

    if (!refundRow) return jsonResponse({ error: 'Refund record not found.' }, 404);
    if (refundRow.status === 'processed') {
      return jsonResponse({ error: 'Refund already processed.' }, 409);
    }

    const psRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: refundRow.bookings.booking_reference,
        amount: Number(refundRow.amount_kobo),
      }),
    });
    const psData = await psRes.json();

    if (!psRes.ok || !psData?.status) {
      await supabase
        .from('refunds')
        .update({ status: 'failed', failure_reason: psData?.message || 'Paystack refund error.' })
        .eq('id', refundRow.id);
      return jsonResponse({ error: psData?.message || 'Paystack refund request failed.' }, 502);
    }

    const providerStatus = String(psData?.data?.status || 'pending').toLowerCase();
    const isFinalProcessed = providerStatus === 'processed';

    await supabase
      .from('refunds')
      .update({
        paystack_refund_ref: String(psData?.data?.id || ''),
        status: isFinalProcessed ? 'processed' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRow.id);

    if (isFinalProcessed) {
      await supabase
        .from('bookings')
        .update({ status: 'refunded', payment_status: 'refunded' })
        .eq('id', refundRow.booking_id);
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          agent_share_kobo: 0,
          sug_share_kobo: 0,
          platform_agent_share_kobo: 0,
          platform_inspection_fee_kobo: 0,
        })
        .eq('booking_id', refundRow.booking_id);
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'REFUND_EXECUTED',
      target_type: 'refund',
      target_id: refundRow.id,
      summary: `Paystack refund ${providerStatus} for booking ${refundRow.bookings.booking_reference}`,
    });

    return jsonResponse({ status: isFinalProcessed ? 'processed' : 'processing', paystack: psData.data });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Refund execution error.' }, 500);
  }
});
