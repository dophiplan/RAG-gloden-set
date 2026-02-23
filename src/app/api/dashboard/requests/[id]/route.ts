import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiUnauthorized, apiNotFound, apiInternalError } from '@/lib/api/response';
import { PAGINATION } from '@/lib/constants';

// DELETE - Delete a request and all its translations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient();
    const { user, adminClient: authAdminClient } = await getAuthUser(supabase);

    if (!user) {
      return apiUnauthorized();
    }

    // Handle both Promise and direct params
    const resolvedParams = params instanceof Promise ? await params : params;
    const requestId = resolvedParams.id;
    console.log('🗑️ Delete request received for ID:', requestId);

    // Use admin client to bypass RLS
    let adminClient;
    try {
      adminClient = authAdminClient || createAdminClient();
      console.log('✅ Admin client created for delete operation');
    } catch (adminError) {
      console.error('❌ Failed to create admin client:', adminError);
      return apiInternalError('관리자 클라이언트 생성에 실패했습니다.');
    }

    // Check if this is a grouped request (has request_id) or individual translation
    console.log('🔍 Fetching translations for request ID:', requestId);
    const { data: translations, error: fetchError } = await adminClient
      .from('translations')
      .select('id, request_id')
      .or(`id.eq.${requestId},request_id.eq.${requestId}`)
      .limit(PAGINATION.MAX_QUERY_LIMIT);

    if (fetchError) {
      console.error('❌ Error fetching translations:', fetchError);
      return apiInternalError('번역 요청 조회 중 오류가 발생했습니다.');
    }

    if (!translations || translations.length === 0) {
      console.log('⚠️ No translations found for request ID:', requestId);
      return apiNotFound('번역 요청');
    }

    // Get all translation IDs to delete
    const translationIds = translations.map(t => t.id);
    console.log(`📋 Found ${translationIds.length} translations to delete:`, translationIds);

    // Delete in order: audit logs, results, products, translations

    // 1. Delete audit logs
    console.log('🗑️ Deleting audit logs...');
    const { error: auditError } = await adminClient
      .from('translation_audit_logs')
      .delete()
      .in('translation_id', translationIds);

    if (auditError) {
      console.error('⚠️ Error deleting audit logs:', auditError);
      // Continue anyway
    } else {
      console.log('✅ Audit logs deleted');
    }

    // 2. Delete translation results
    console.log('🗑️ Deleting translation results...');
    const { error: resultsError } = await adminClient
      .from('translation_results')
      .delete()
      .in('translation_id', translationIds);

    if (resultsError) {
      console.error('⚠️ Error deleting translation results:', resultsError);
      // Continue anyway
    } else {
      console.log('✅ Translation results deleted');
    }

    // 3. Delete translation products
    console.log('🗑️ Deleting translation products...');
    const { error: productsError } = await adminClient
      .from('translation_products')
      .delete()
      .in('translation_id', translationIds);

    if (productsError) {
      console.error('⚠️ Error deleting translation products:', productsError);
      // Continue anyway
    } else {
      console.log('✅ Translation products deleted');
    }

    // 4. Delete translations
    console.log('🗑️ Deleting translations...');
    const { error: deleteError } = await adminClient
      .from('translations')
      .delete()
      .in('id', translationIds);

    if (deleteError) {
      console.error('❌ Error deleting translations:', deleteError);
      return apiInternalError('번역 삭제 중 오류가 발생했습니다.', deleteError.message);
    }

    console.log('✅ All translations deleted successfully');

    return apiSuccess({
      deleted: translationIds.length,
    });
  } catch (error) {
    console.error('❌ Error deleting request:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return apiInternalError(
      '요청 삭제에 실패했습니다.',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
