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
    if (role !== 'sug_admin' && role !== 'sug_president' && role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden: Only SUG Admin or Super Admin can approve or reject lodges.' }, 403);
    }

    const { property_id, decision, rejection_reason } = await req.json();
    if (!property_id || !['approved', 'rejected', 'deleted'].includes(decision)) {
      return jsonResponse({ error: 'Invalid property_id or decision.' }, 400);
    }
    if (decision === 'rejected' && !String(rejection_reason || '').trim()) {
      return jsonResponse({ error: 'Rejection reason is mandatory when rejecting a lodge.' }, 400);
    }
    if (decision === 'deleted' && role !== 'super_admin') {
      return jsonResponse({ error: 'Only Super Admin can permanently delete fraudulent listings.' }, 403);
    }

    const { data: prop } = await supabase
      .from('properties')
      .select('*')
      .eq('id', property_id)
      .single();

    if (!prop) return jsonResponse({ error: 'Lodge not found.' }, 404);

    // Server-side safety check before approving
    if (
      decision === 'approved' &&
      /(https?:\/\/|www\.|paystack\.com|flutterwave|pay\s+rent\s+to\s+agent)/i.test(String(prop.description || ''))
    ) {
      return jsonResponse(
        { error: 'Cannot approve lodge: description contains external payment link or rent collection wording.' },
        400
      );
    }

    if (decision === 'deleted') {
      await supabase.from('properties').delete().eq('id', property_id);
    } else {
      await supabase
        .from('properties')
        .update({
          verification_status: decision === 'approved' ? 'SUG Verified' : 'Rejected',
          lodge_status: decision === 'approved' ? 'Approved' : 'Rejected',
          rejection_reason: decision === 'rejected' ? String(rejection_reason).trim() : null,
        })
        .eq('id', property_id);
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `LODGE_${decision.toUpperCase()}`,
      target_type: 'property',
      target_id: property_id,
      summary: `${role} marked lodge ${prop.title} as ${decision}${rejection_reason ? `: ${rejection_reason}` : ''}`,
    });

    await supabase.from('notifications').insert({
      recipient_id: prop.agent_id,
      recipient_role: 'agent',
      title: `Lodge ${decision === 'approved' ? 'Approved' : 'Rejected'} — ${prop.title}`,
      message:
        decision === 'approved'
          ? `${prop.title} is now live to ABSU students.`
          : `Reason: ${rejection_reason}`,
      related_property_id: property_id,
      category: 'verification',
    });

    return jsonResponse({ ok: true, property_id, decision });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Lodge approval error.' }, 500);
  }
});
