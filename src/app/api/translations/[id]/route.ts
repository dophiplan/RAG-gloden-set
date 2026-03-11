import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TranslationUpdateInput } from '@/types';
import { TranslationRepository } from '@/repositories';
import { TranslationCrudService } from '@/services';
import { apiSuccess, apiUnauthorized, apiNotFound, apiInternalError, apiConflict } from '@/lib/api/response';
import { getAuthUser } from '@/lib/api-auth';

// GET - Get single translation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    
    // Use admin client to bypass RLS
    const dbClient = adminClient || createAdminClient();

    // Use Service to fetch translation
    const service = new TranslationCrudService(dbClient);
    const translation = await service.getTranslation(id);

    if (!translation) {
      return apiNotFound('번역');
    }

    return apiSuccess(translation);
  } catch (error) {
    console.error('Error fetching translation:', error);
    return apiInternalError('번역을 불러오는데 실패했습니다.');
  }
}

// PATCH - Update translation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    
    // Use admin client to bypass RLS
    const dbClient = adminClient || createAdminClient();
    const body: TranslationUpdateInput & { version_updated_at?: string | null; platform_codes?: string[] } = await request.json();

    // Optimistic Locking: Check for concurrent edits using Repository
    if (body.updated_at) {
      const repository = new TranslationRepository(dbClient);
      const lockResult = await repository.checkVersion(id, undefined, body.updated_at);

      if (!lockResult.success) {
        if (lockResult.errorCode === 'RECORD_NOT_FOUND') {
          return apiNotFound('번역');
        }

        return apiConflict(
          lockResult.message || '다른 사용자가 이 번역을 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
          {
            serverUpdatedAt: lockResult.serverTimestamp,
            clientUpdatedAt: body.updated_at,
          }
        );
      }
    }

    // Use Service for update operations
    const service = new TranslationCrudService(dbClient);

    // Build update data for translation table
    const updateData: Record<string, unknown> = {};
    if (body.source_text !== undefined) updateData.source_text = body.source_text.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.version !== undefined) updateData.version = body.version?.trim() || null;
    if (body.version_updated_at !== undefined) updateData.version_updated_at = body.version_updated_at;
    if ((body as any).dev_code !== undefined) updateData.dev_code = (body as any).dev_code?.trim() || null;

    // Update translation using Service (with audit logging)
    if (Object.keys(updateData).length > 0) {
      await service.updateTranslation(
        id,
        updateData,
        {
          userId: user.id,
          userEmail: user.email || '',
        }
      );
    }

    // Handle product_codes update if provided
    if (body.product_codes !== undefined) {
      await service.updateProductCodes(id, body.product_codes, body.version);
    }

    // Handle platform_codes update if provided
    if (body.platform_codes !== undefined) {
      await service.updatePlatformCodes(id, body.platform_codes);
    }

    // Fetch updated translation with relations
    const updatedTranslation = await service.getTranslation(id);

    return apiSuccess(updatedTranslation);
  } catch (error) {
    console.error('Error updating translation:', error);
    return apiInternalError('번역을 업데이트하는데 실패했습니다.');
  }
}

// DELETE - Delete translation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    
    // Use admin client to bypass RLS
    const dbClient = adminClient || createAdminClient();

    // Use Service for deletion (includes audit logging)
    const service = new TranslationCrudService(dbClient);
    
    await service.deleteTranslation(id, {
      userId: user.id,
      userEmail: user.email || '',
    });

    return apiSuccess({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Translation not found') {
      return apiNotFound('번역');
    }
    console.error('Error deleting translation:', error);
    return apiInternalError('번역을 삭제하는데 실패했습니다.');
  }
}
