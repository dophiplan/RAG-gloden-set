import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { apiUnauthorized, apiInternalError, apiForbidden } from './response';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  isAdmin: boolean;
}

/**
 * Authenticate the request and return user info
 * Returns null if authentication fails
 */
export async function authenticateRequest(): Promise<{ context: AuthContext } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: apiUnauthorized(),
    };
  }

  // Check user roles (using roles array)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[authenticateRequest] Failed to fetch user profile:', profileError);
    return {
      error: apiInternalError('사용자 정보를 조회할 수 없습니다.'),
    };
  }

  const isAdmin = profile?.roles?.includes('master') || profile?.roles?.includes('1st_master') || false;

  return {
    context: {
      user,
      supabase,
      isAdmin,
    },
  };
}

/**
 * Require admin role for the request
 * Returns error response if user is not an admin
 */
export async function requireAdmin(): Promise<{ context: AuthContext } | { error: NextResponse }> {
  const auth = await authenticateRequest();

  if ('error' in auth) {
    return auth;
  }

  if (!auth.context.isAdmin) {
    return {
      error: apiForbidden('관리자 권한이 필요합니다.'),
    };
  }

  return { context: auth.context };
}

/**
 * Type guard to check if result is an error response
 */
export function isErrorResponse<T>(
  result: { context: T } | { error: NextResponse }
): result is { error: NextResponse } {
  return 'error' in result;
}

/**
 * Utility: Extract context or return error
 * Usage:
 * ```
 * const auth = await requireAdmin();
 * if (isErrorResponse(auth)) return auth.error;
 * const { user, supabase } = auth.context;
 * ```
 */
