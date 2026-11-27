import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '../domain/types';

export const TARGET_SUPABASE_PROJECT_REF = 'jjidjcnyknoavmefrrpi';
export const TARGET_SUPABASE_URL = `https://${TARGET_SUPABASE_PROJECT_REF}.supabase.co`;

const envSupabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    : undefined;
const envSupabaseAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    : undefined;

const resolvedSupabaseUrl =
  envSupabaseUrl && envSupabaseUrl.startsWith('http') && !envSupabaseUrl.includes('YOUR_PROJECT_REF')
    ? envSupabaseUrl
    : TARGET_SUPABASE_URL;

function isLikelyValidAnonKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed.includes('YOUR_') ||
    trimmed.includes('MY_') ||
    trimmed.includes('PLACEHOLDER') ||
    trimmed.length < 30
  ) {
    return false;
  }
  return trimmed.startsWith('eyJ') || trimmed.startsWith('sb_publishable_');
}

export function getSupabaseDiagnostics() {
  const hasAnonKey = isLikelyValidAnonKey(envSupabaseAnonKey);
  const projectRefMatch = resolvedSupabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  const detectedRef = projectRefMatch?.[1] || 'unknown';
  return {
    targetProjectRef: TARGET_SUPABASE_PROJECT_REF,
    resolvedUrl: resolvedSupabaseUrl,
    detectedProjectRef: detectedRef,
    matchesTargetProject: detectedRef === TARGET_SUPABASE_PROJECT_REF,
    hasAnonKey,
    configured: hasAnonKey && detectedRef === TARGET_SUPABASE_PROJECT_REF,
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    isLikelyValidAnonKey(envSupabaseAnonKey) && resolvedSupabaseUrl.startsWith('https://')
  );
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(resolvedSupabaseUrl, envSupabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return cachedClient;
}

export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  projectRef: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  const diag = getSupabaseDiagnostics();
  if (!client) {
    return {
      connected: false,
      projectRef: diag.detectedProjectRef,
      error: 'VITE_SUPABASE_ANON_KEY is not configured in environment variables.',
    };
  }
  try {
    const { error } = await client.auth.getSession();
    if (error) {
      return { connected: false, projectRef: diag.detectedProjectRef, error: error.message };
    }
    return { connected: true, projectRef: diag.detectedProjectRef };
  } catch (err: any) {
    return {
      connected: false,
      projectRef: diag.detectedProjectRef,
      error: err?.message || 'Unable to reach Supabase project.',
    };
  }
}

export async function fetchServerControlledUserRole(userId: string): Promise<UserRole> {
  const client = getSupabaseClient();
  if (!client) return 'student';
  try {
    const { data: roleRows } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1);
    const dbRole = roleRows?.[0]?.role as string | undefined;
    if (dbRole === 'tech_admin' || dbRole === 'tech_manager' || dbRole === 'super_admin') {
      return 'super_admin';
    }
    if (dbRole === 'sug_admin' || dbRole === 'sug_president') return 'sug_admin';
    if (dbRole === 'agent') return 'agent';
    return 'student';
  } catch {
    return 'student';
  }
}

export function subscribeMarketplaceRealtime(onEvent: (table: string, payload: unknown) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel('absu-lodgesafe-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, (payload) =>
      onEvent('properties', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) =>
      onEvent('bookings', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) =>
      onEvent('payments', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, (payload) =>
      onEvent('refunds', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, (payload) =>
      onEvent('settlements', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) =>
      onEvent('notifications', payload)
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
