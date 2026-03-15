import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiInternalError, apiForbidden } from '@/lib/api/response';

// DELETE - Clear all glossary terms (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Check if user is admin, 1st_master, or master (roles array)
    const { data: userData } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const userRoles = userData?.roles || [];
    const canClear = 
      userRoles.includes('admin') ||
      userRoles.includes('1st_master') || 
      userRoles.includes('master');

    if (!canClear) {
      return apiForbidden('관리자만 접근 가능합니다.');
    }

    // Delete all glossary_products first (foreign key constraint)
    const { error: productsError } = await supabase
      .from('glossary_products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (productsError) {
      console.error('Error deleting glossary_products:', productsError);
    }

    // Delete all glossary_audit_logs
    const { error: auditError } = await supabase
      .from('glossary_audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (auditError) {
      console.error('Error deleting glossary_audit_logs:', auditError);
    }

    // Delete all glossary terms
    const { data: deleted, error: glossaryError } = await supabase
      .from('glossary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (glossaryError) {
      console.error('Error deleting glossary terms:', glossaryError);
      throw glossaryError;
    }

    return apiSuccess({
      success: true,
      deleted_count: deleted?.length || 0,
      message: `${deleted?.length || 0}개 용어가 삭제되었습니다.`,
    });
  } catch (error) {
    console.error('Error clearing glossary:', error);
    return apiInternalError('용어집 삭제에 실패했습니다.');
  }
}
