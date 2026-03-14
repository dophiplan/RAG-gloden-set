import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { apiUnauthorized, apiInternalError, apiForbidden } from './response';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  isAdmin: boolean;
}

// 개발 모드 인증 바이패스 헬퍼
async function getDevBypassUser(): Promise<User | null> {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_AUTH_BYPASS !== 'true') {
    return null;
  }

  try {
    const adminClient = createAdminClient();
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', process.env.DEV_BYPASS_EMAIL || 'admin@example.com')
      .single();

    if (existingUser) {
      console.warn('[AUTH BYPASS] Development mode bypass used');
      return { id: existingUser.id, email: existingUser.email } as User;
    }
  } catch (err) {
    console.error('[AUTH BYPASS] Failed:', err);
  }
  return null;
}

/**
 * Authenticate the request and return user info
 * Returns null if authentication fails
 */
export async function authenticateRequest(): Promise<{ context: AuthContext } | { error: NextResponse }> {
  const supabase = await createClient();
  let { data: { user }, error: authError } = await supabase.auth.getUser();

  // 개발 모드: 인증 바이패스
  if ((authError || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
    const bypassUser = await getDevBypassUser();
    if (bypassUser) {
      user = bypassUser;
      authError = null;
    }
  }

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
