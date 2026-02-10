import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';

export async function GET() {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({
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

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
