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
      .select('id, name, email, roles, permissions, work_products, account_level')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      
      // Development mode: return admin user for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  DEV MODE: Returning admin@example.com as fallback');
        return apiSuccess({
          user: {
            id: user.id,
            name: '관리자',
            email: 'admin@example.com',
            roles: ['1st_master'],
            permissions: [],
            work_products: [],
            account_level: '1st_master',
          },
        });
      }
      
      // Fallback to auth user data
      return apiSuccess({
        user: {
          id: user.id,
          name: null,
          email: user.email || '',
          roles: [],
          permissions: [],
          work_products: [],
          account_level: 'user',
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
        account_level: userProfile.account_level || 'user',
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return apiInternalError('Internal server error');
  }
}
