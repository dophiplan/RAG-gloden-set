import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { FIRST_MASTER_EMAIL } from '@/types/users';

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Use admin client for all database operations including authorization check
    const adminClient = createAdminClient();

    // Check if user is master (has 'admin' role)
    const { data: adminUser, error: checkError } = await adminClient
      .from('users')
      .select('account_level')
      .eq('id', authUser.id)
      .single();

    console.log('Authorization check:', { adminUser, checkError, authUserId: authUser.id });

    // Check for master roles
    if (!adminUser || !(adminUser.account_level === 'master' || adminUser.account_level === '1st_master')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // Await params to get the user ID
    const { id: userId } = await params;
    const body = await request.json();
    const { name, email, password, products, accountLevel, permissions, translatorLanguages } = body;

    // Protect 1st_master account from being modified by master users
    const { data: targetUser } = await adminClient
      .from('users')
      .select('email, account_level')
      .eq('id', userId)
      .single();

    const isTargetFirstMaster = targetUser?.email === FIRST_MASTER_EMAIL || targetUser?.account_level === '1st_master';
    const isRequesterFirstMaster = adminUser.account_level === '1st_master';

    if (isTargetFirstMaster && !isRequesterFirstMaster) {
      return NextResponse.json(
        { error: '최고 관리자 계정은 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // Prevent users from changing their own account level (security protection)
    if (userId === authUser.id && accountLevel !== undefined) {
      const currentLevel = adminUser.account_level;
      if (currentLevel !== accountLevel) {
        return NextResponse.json(
          { error: '본인의 계정 권한은 변경할 수 없습니다.' },
          { status: 403 }
        );
      }
    }

    // Fetch products from database
    const { data: productsData } = await adminClient.from('products').select('code, name');
    const productsMap = (productsData || []).reduce((acc, p) => { acc[p.code] = p.name; return acc; }, {} as Record<string, string>);

    // Update user profile
    interface UserUpdateData {
      name?: string;
      email?: string;
      roles?: string[];
      work_products?: string[];
    }

    const updateData: UserUpdateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (accountLevel !== undefined) {
      // Update roles based on account level (only the primary role)
      updateData.roles = [accountLevel];

      // Master users should have all products
      if (accountLevel === 'master') {
        updateData.work_products = Object.keys(productsMap);
      } else if (products !== undefined) {
        updateData.work_products = products;
      }
    } else if (products !== undefined) {
      updateData.work_products = products;
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) throw updateError;

    // Update password if provided
    if (password) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (passwordError) {
        console.error('Password update error:', passwordError);
        // Don't throw - password update is optional
      }
    }

    // Update permissions
    // Fetch current user to check their role
    const { data: currentUser } = await adminClient
      .from('users')
      .select('account_level')
      .eq('id', userId)
      .single();

    // Determine the effective account level (new one if changing, or current one)
    const effectiveAccountLevel = accountLevel !== undefined
      ? accountLevel
      : currentUser?.account_level;

    // Master users always get all permissions
    const finalPermissions = effectiveAccountLevel === 'master'
      ? ['reviewer', 'requester', 'deployer']
      : permissions;

    if (finalPermissions !== undefined) {
      // Update permissions in users table
      await adminClient
        .from('users')
        .update({ permissions: finalPermissions })
        .eq('id', userId);
    }

    // Update translator languages if provided
    if (translatorLanguages !== undefined) {
      // Delete existing translator languages
      await adminClient
        .from('translator_languages')
        .delete()
        .eq('user_id', userId);

      // Insert new translator languages
      if (Array.isArray(translatorLanguages) && translatorLanguages.length > 0) {
        const languageEntries = translatorLanguages.map((lang: string) => ({
          user_id: userId,
          language_code: lang,
        }));

        await adminClient
          .from('translator_languages')
          .insert(languageEntries);
      }
    }

    // Fetch updated user
    const { data: updatedUser } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Create audit log (non-blocking)
    void adminClient.from('user_audit_logs').insert({
      user_id: authUser.id,
      user_email: authUser.email,
      action: 'update',
      target_user_id: userId,
      target_user_email: targetUser?.email,
      field_name: Object.keys(updateData).join(', ') || 'permissions',
      old_value: JSON.stringify({ name: targetUser?.email }), // Simplified old value
      new_value: JSON.stringify(updateData),
    }).then(({ error }) => {
      if (error) console.error('[Audit Log] Failed to log user update:', error);
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: '사용자 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}
