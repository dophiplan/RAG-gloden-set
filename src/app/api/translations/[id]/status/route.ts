import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { TranslationStatus } from '@/types/translations';
import { apiSuccess, apiUnauthorized, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';

// PATCH - Update translation status
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
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return apiBadRequest('Status is required');
    }

    // Use Service to update status with validation
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    try {
      const result = await service.updateStatus(
        id,
        newStatus as TranslationStatus,
        {
          userId: user.id,
          userEmail: user.email || '',
        }
      );

      return apiSuccess({ success: true, newStatus, oldStatus: result.oldStatus });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Translation not found') {
          return apiNotFound('번역');
        }
        // Status transition validation error
        if (error.message.includes('상태에서는 다음 상태로만')) {
          return apiBadRequest(error.message);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating status:', error);
    return apiInternalError('상태를 변경하는데 실패했습니다.');
  }
}
