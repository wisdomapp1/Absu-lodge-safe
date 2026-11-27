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
      return jsonResponse({ error: 'Forbidden: Only Super Admin can approve, suspend, or ban agents.' }, 403);
    }

    const { agent_id, decision, reason } = await req.json();
    if (!agent_id || !['approved', 'rejected', 'suspended', 'banned'].includes(decision)) {
      return jsonResponse({ error: 'Invalid agent_id or decision.' }, 400);
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .update({
        status: decision,
        ban_reason: decision === 'banned' ? reason || 'Policy violation' : null,
        banned_at: decision === 'banned' ? new Date().toISOString() : null,
      })
      .eq('id', agent_id)
      .select('*')
      .single();

    if (error || !agent) return jsonResponse({ error: error?.message || 'Agent not found.' }, 404);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `AGENT_${decision.toUpperCase()}`,
      target_type: 'agent',
      target_id: agent.id,
      summary: `Super Admin marked agent ${agent.full_name} as ${decision}.`,
    });

    await supabase.from('notifications').insert({
      recipient_id: agent.user_id,
      recipient_role: 'agent',
      title: `Agent Account ${decision.toUpperCase()}`,
      message: reason ? `Status changed to ${decision}: ${reason}` : `Your agent account status is now ${decision}.`,
      category: 'verification',
    });

    return jsonResponse({ agent });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'Agent approval error.' }, 500);
  }
});
