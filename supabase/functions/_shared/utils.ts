import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const INSPECTION_FEE_KOBO = 300000; // Fixed ₦3,000

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL') || 'https://jjidjcnyknoavmefrrpi.supabase.co';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in Edge Function secrets.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const url = Deno.env.get('SUPABASE_URL') || 'https://jjidjcnyknoavmefrrpi.supabase.co';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

export async function getServerRole(supabase: ReturnType<typeof getServiceClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .limit(1);
  const role = data?.[0]?.role || 'student';
  if (role === 'tech_admin' || role === 'tech_manager') return 'super_admin';
  return role;
}

export function computeSplitAmounts(agentFeeKobo: number) {
  const agentShareKobo = Math.round((agentFeeKobo * 40) / 100);
  const sugShareKobo = Math.round((agentFeeKobo * 35) / 100);
  const platformAgentShareKobo = agentFeeKobo - agentShareKobo - sugShareKobo;
  const platformTotalKobo = platformAgentShareKobo + INSPECTION_FEE_KOBO;
  return {
    agentFeeKobo,
    inspectionFeeKobo: INSPECTION_FEE_KOBO,
    totalBookingFeeKobo: agentFeeKobo + INSPECTION_FEE_KOBO,
    agentShareKobo,
    sugShareKobo,
    platformAgentShareKobo,
    platformInspectionFeeKobo: INSPECTION_FEE_KOBO,
    platformTotalKobo,
  };
}

export async function verifyPaystackHmac(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
