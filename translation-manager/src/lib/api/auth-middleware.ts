import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

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
      error: NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      ),
    };
  }

  // Check user role
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[authenticateRequest] Failed to fetch user profile:', profileError);
    return {
      error: NextResponse.json(
        { error: '사용자 정보를 조회할 수 없습니다.' },
        { status: 500 }
      ),
    };
  }

  const isAdmin = profile?.role === 'admin';

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
      error: NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      ),
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
