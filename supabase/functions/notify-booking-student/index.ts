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

    const { booking_id, title, message } = await req.json();
    if (!booking_id) return jsonResponse({ error: 'booking_id is required.' }, 400);

    const supabase = getServiceClient();
    const { data: bk } = await supabase
      .from('bookings')
      .select('id, booking_reference, student_id, property_id')
      .eq('id', booking_id)
      .single();

    if (!bk) return jsonResponse({ error: 'Booking not found.' }, 404);

    await supabase.from('notifications').insert({
      recipient_id: bk.student_id,
      recipient_role: 'student',
      title: title || `Booking Update — ${bk.booking_reference}`,
      message:
        message ||
        'Booking confirmed on platform. Remember: pay rent DIRECT to landlord or caretaker after inspection with a receipt.',
      related_booking_ref: bk.booking_reference,
      related_property_id: bk.property_id,
      category: 'booking',
    });

    // Honest SMS status: never claim SMS sent unless an SMS gateway secret is actually configured
    const smsConfigured = Boolean(Deno.env.get('SMS_API_KEY'));
    return jsonResponse({
      notified: true,
      smsSent: false,
      smsConfigured,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Student notification failed.' }, 500);
  }
});
