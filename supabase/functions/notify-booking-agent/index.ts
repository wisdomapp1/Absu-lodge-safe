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

    const { booking_id } = await req.json();
    if (!booking_id) return jsonResponse({ error: 'booking_id is required.' }, 400);

    const supabase = getServiceClient();
    const { data: bk } = await supabase
      .from('bookings')
      .select('*, properties(title, room_type), agents(user_id, full_name, phone)')
      .eq('id', booking_id)
      .single();

    if (!bk) return jsonResponse({ error: 'Booking not found.' }, 404);

    const recipientUid = bk.agents?.user_id || bk.agent_id;
    const message = `New booking ${bk.booking_reference} for ${bk.properties?.title || 'Lodge'} (${bk.inspection_date || ''} ${bk.inspection_time || ''}). Contact student within 2 hours.`;

    await supabase.from('notifications').insert({
      recipient_id: recipientUid,
      recipient_role: 'agent',
      title: `Booking Alert — ${bk.booking_reference}`,
      message,
      related_booking_ref: bk.booking_reference,
      related_property_id: bk.property_id,
      category: 'booking',
    });

    const studentPhone = String(bk.student_phone || '').replace(/\D/g, '');
    const waPhone = studentPhone.startsWith('0') ? `234${studentPhone.slice(1)}` : studentPhone;
    const whatsappDeepLink = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(
          `Hello, this is ${bk.agents?.full_name || 'your ABSU LodgeSafe agent'} confirming inspection ${bk.booking_reference}.`
        )}`
      : null;

    return jsonResponse({
      notified: true,
      whatsappDeepLink,
      smsConfigured: false,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Agent notification failed.' }, 500);
  }
});
