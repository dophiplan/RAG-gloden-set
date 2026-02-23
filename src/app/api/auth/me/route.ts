import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiUnauthorized, apiInternalError } from '@/lib/api/response';

export async function GET() {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return apiUnauthorized();
    }

    // Fetch user profile from users table
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('id, name, email, roles, permissions, work_products')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      // Fallback to auth user data
      return apiSuccess({
        user: {
          id: user.id,
          name: null,
          email: user.email || '',
          roles: [],
          permissions: [],
          work_products: [],
        },
      });
    }

    return apiSuccess({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        roles: userProfile.roles || [],
        permissions: userProfile.permissions || [],
        work_products: userProfile.work_products || [],
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return apiInternalError('Internal server error');
  }
}
