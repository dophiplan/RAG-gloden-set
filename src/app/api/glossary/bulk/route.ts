import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { glossaryBulkApproveSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { apiSuccess, apiUnauthorized, apiBadRequest, apiInternalError } from '@/lib/api/response';
import { GlossaryRepository } from '@/repositories';

interface BulkApproveInput {
  ids: string[];
  action: 'approve' | 'reject';
}

interface BulkDeleteInput {
  ids: string[];
}

// PATCH - Bulk approve or reject glossary terms
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Check rate limit for glossary bulk operations
    const rateLimitResult = await enforceRateLimit(user.id, 'glossary_bulk');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = validateAndSanitize(glossaryBulkApproveSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error);
    }

    const body = validation.data;

    // Use Repository with Audit Logging (Phase 4)
    const repository = new GlossaryRepository(supabase);
    
    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const userInfo = {
      id: user.id,
      name: userProfile?.name,
      email: user.email || '',
    };

    // Note: For bulk operations, we still use SQL function for atomicity
    // but we add audit logs through the repository
    const functionName = body.action === 'approve'
      ? 'bulk_approve_glossary'
      : 'bulk_reject_glossary';

    const { data, error } = await supabase.rpc(functionName, {
      p_term_ids: body.ids,
      p_approved_by: user.id,
    });

    if (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }

    // data is an array with a single row: [{ success_count, failed_count }]
    const result = Array.isArray(data) && data.length > 0 ? data[0] : { success_count: 0, failed_count: 0 };

    // Create audit logs for bulk operation (non-blocking)
    // We log all attempted IDs, the SQL function handles which ones actually changed
    const auditAction = body.action === 'approve' ? 'bulk_approve' : 'bulk_reject';
    
    for (const id of body.ids) {
      repository['createAuditLog']({
        glossary_term_id: id,
        user_id: user.id,
        user_name: userInfo.name,
        user_email: userInfo.email,
        action: auditAction,
      }).catch((err: Error) => {
        console.error('[Glossary Bulk] Failed to create audit log:', err);
      });
    }

    return apiSuccess({
      success: true,
      updated: result.success_count || 0,
      failed: result.failed_count || 0,
    });
  } catch (error) {
    console.error('Error bulk approving/rejecting glossary terms:', error);
    return apiInternalError('일괄 승인/거부에 실패했습니다.');
  }
}

// DELETE - Bulk delete glossary terms (1st_master+ only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Check if user has 1st_master, master, or admin role
    const { data: userProfile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const userRoles = userProfile?.roles || [];
    const canDelete = 
      userRoles.includes('1st_master') || 
      userRoles.includes('master') || 
      userRoles.includes('admin');

    if (!canDelete) {
      return apiUnauthorized();
    }

    // Check rate limit for glossary bulk operations
    const rateLimitResult = await enforceRateLimit(user.id, 'glossary_bulk');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse request body
    const body = await request.json();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return apiBadRequest('삭제할 항목을 선택해주세요.');
    }

    const { ids } = body as BulkDeleteInput;

    // Use Repository with Audit Logging
    const repository = new GlossaryRepository(supabase);
    
    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const userInfo = {
      id: user.id,
      name: userProfile?.name,
      email: user.email || '',
    };

    let successCount = 0;
    let failedCount = 0;

    // Delete each term and create audit logs
    for (const id of ids) {
      try {
        // Get term info before deletion for audit log
        const term = await repository.findById(id);
        if (!term) {
          failedCount++;
          continue;
        }

        // Delete the term
        const { error } = await supabase
          .from('glossary')
          .delete()
          .eq('id', id);

        if (error) {
          console.error(`Error deleting term ${id}:`, error);
          failedCount++;
          continue;
        }

        // Create audit log (non-blocking)
        repository['createAuditLog']({
          glossary_term_id: id,
          user_id: user.id,
          user_name: userInfo.name,
          user_email: userInfo.email,
          action: 'bulk_delete',
          old_value: `${term.term} = ${term.translation}`,
          metadata: {
            language_code: term.language_code,
            deleted_term: term.term,
          },
        }).catch((err: Error) => {
          console.error('[Glossary Bulk Delete] Failed to create audit log:', err);
        });

        successCount++;
      } catch (err) {
        console.error(`Error processing delete for term ${id}:`, err);
        failedCount++;
      }
    }

    return apiSuccess({
      success: true,
      deleted: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('Error bulk deleting glossary terms:', error);
    return apiInternalError('일괄 삭제에 실패했습니다.');
  }
}
