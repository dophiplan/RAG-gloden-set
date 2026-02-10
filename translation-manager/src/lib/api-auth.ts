import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';

// Helper to get authenticated user
// Returns { user, adminClient } or { error } if authentication fails
export async function getAuthUser(supabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Allow bypassing auth in development if explicitly enabled
  if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  API AUTH BYPASS ENABLED - Development mode only');

    try {
      const adminClient = createAdminClient();

      // Find a real user from the DB to satisfy foreign key constraints
      const { data: existingUser } = await adminClient
        .from('users')
        .select('id, email')
        .limit(1)
        .single();

      const userId = existingUser?.id || '00000000-0000-0000-0000-000000000000';
      const userEmail = existingUser?.email || 'test@example.com';

      return {
        user: {
          id: userId,
          email: userEmail,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
        error: null,
        adminClient,
      };
    } catch {
      return {
        user: null,
        error: 'Authentication required',
        adminClient: null,
      };
    }
  }

  // Authentication failed - return error
  if (authError || !user) {
    return {
      user: null,
      error: authError?.message || 'Authentication required',
      adminClient: null
    };
  }

  return { user, error: null, adminClient: null };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
}
