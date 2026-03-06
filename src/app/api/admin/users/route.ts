import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiSuccess, apiUnauthorized, apiInternalError } from '@/lib/api/response';

// Security: Verify user is master (account_level: master or 1st_master)
async function verifyMasterUser(supabase: SupabaseClient): Promise<{ authorized: boolean; userId?: string; isDevBypass?: boolean }> {
  const { data: { user }, error } = await supabase.auth.getUser();

  // Development mode bypass
  if ((error || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
    console.warn('⚠️  DEV MODE: Auth bypass enabled for /api/admin/users');
    return { authorized: true, userId: 'dev-mode-user', isDevBypass: true };
  }

  if (error || !user) {
    return { authorized: false };
  }

  // Check if user has master or 1st_master account level
  const { data: userProfile } = await supabase
    .from('users')
    .select('account_level')
    .eq('id', user.id)
    .single();

  const isMaster = userProfile?.account_level === 'master' || userProfile?.account_level === '1st_master';

  return {
    authorized: isMaster,
    userId: user.id
  };
}

/**
 * GET - Get all users (master only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { authorized } = await verifyMasterUser(supabase);

    if (!authorized) {
      return apiUnauthorized();
    }

    const adminClient = createAdminClient();

    const { data: users, error } = await adminClient
      .from('users')
      .select('id, email, name, roles, permissions, work_products, work_scope, work_languages, account_level, created_at')
      .order('name', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Fetch translator languages for all users
    const { data: allTranslatorLanguages } = await adminClient
      .from('translator_languages')
      .select('user_id, language_code');

    // Map translator languages to users
    const usersWithLanguages = users?.map(user => {
      const userLanguages = allTranslatorLanguages
        ?.filter(tl => tl.user_id === user.id)
        ?.map(tl => tl.language_code) || [];

      return {
        ...user,
        translatorLanguages: userLanguages,
      };
    });

    return apiSuccess({ users: usersWithLanguages });
  } catch (error) {
    console.error('Error fetching users:', error);
    return apiInternalError(error instanceof Error ? error.message : '알 수 없는 오류');
  }
}
