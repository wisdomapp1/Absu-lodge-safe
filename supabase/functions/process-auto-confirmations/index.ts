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
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isCron = Boolean(cronSecret && req.headers.get('x-cron-secret') === cronSecret);
    const supabase = getServiceClient();

    if (!isCron) {
      const user = await getAuthenticatedUser(req);
      if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);
      const role = await getServerRole(supabase, user.id);
      if (role !== 'super_admin') {
        return jsonResponse({ error: 'Forbidden: Only Super Admin or scheduled cron can trigger auto-confirmations.' }, 403);
      }
    }

    const nowIso = new Date().toISOString();
    const { data: candidates, error } = await supabase
      .from('bookings')
      .select('id, booking_reference')
      .in('status', ['awaiting_inspection', 'inspection_scheduled'])
      .eq('payment_status', 'held')
      .eq('refund_locked', false)
      .lte('split_at', nowIso);

    if (error) return jsonResponse({ error: error.message }, 500);

    const confirmedRefs: string[] = [];
    for (const bk of candidates || []) {
      const { data: refunds } = await supabase
        .from('refunds')
        .select('id')
        .eq('booking_id', bk.id)
        .limit(1);
      if (refunds && refunds.length > 0) continue;

      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          confirmed_at: nowIso,
          auto_confirmed: true,
        })
        .eq('id', bk.id);

      confirmedRefs.push(bk.booking_reference);
    }

    return jsonResponse({ autoConfirmedCount: confirmedRefs.length, confirmedRefs });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Auto-confirmation error.' }, 500);
  }
});
