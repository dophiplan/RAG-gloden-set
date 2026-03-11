import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGlossaryRollbackService } from '@/services/glossary_rollback_service';
import { logDeprecatedAPICall } from '@/lib/monitoring/deprecated-api-monitor';

interface RevertRequest {
  glossaryId: string;
  auditLogId: string;
  expectedVersion?: number;
  conflictResolution?: 'reject' | 'overwrite' | 'prompt';
}

/**
 * @deprecated 이 엔드포인트는 /api/rollback으로 통합되었습니다.
 * 마이그레이션: POST /api/rollback
 * Body: { operation: 'single', entityType: 'glossary', entityId: '...' }
 * 
 * POST - Revert a glossary term to a previous version
 * 
 * Request body:
 * {
 *   glossaryId: string;
 *   auditLogId: string;
 *   expectedVersion?: number; // For optimistic locking
 *   conflictResolution?: 'reject' | 'overwrite' | 'prompt';
 * }
 */
export async function POST(request: NextRequest) {
  // Log deprecated API usage
  logDeprecatedAPICall(request, '/api/glossary/revert');
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Get user profile for audit log
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('[API Glossary Revert] Failed to fetch user profile:', profileError);
    }

    const body: RevertRequest = await request.json();

    // Validate request
    if (!body.glossaryId || !body.auditLogId) {
      return NextResponse.json(
        { error: '용어 ID와 변경 이력 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if user has access to this glossary term (RLS handles this, but explicit check for better error message)
    const { data: glossaryCheck, error: glossaryError } = await supabase
      .from('glossary')
      .select('id, version')
      .eq('id', body.glossaryId)
      .single();
    
    if (glossaryError || !glossaryCheck) {
      return NextResponse.json(
        { error: '용어를 찾을 수 없거나 접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    const rollbackService = createGlossaryRollbackService(supabase);

    // If expectedVersion provided, validate first
    if (typeof body.expectedVersion === 'number') {
      const currentVersion = await rollbackService.getCurrentVersion(body.glossaryId);
      
      if (currentVersion !== null && currentVersion !== body.expectedVersion) {
        // Version conflict
        if (body.conflictResolution === 'reject') {
          return NextResponse.json(
            {
              error: '버전 충돌이 발생했습니다.',
              code: 'EDIT_CONFLICT',
              serverVersion: currentVersion,
              message: '다른 사용자가 이 용어를 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
            },
            { status: 409 }
          );
        }
        } else if (body.conflictResolution === 'overwrite') {
          // User chose to overwrite - proceed with current version
          console.log('[API Glossary Revert] Overwriting with conflict resolution');
        } else {
          // Default behavior: reject on conflict
          return NextResponse.json(
            {
              error: '버전 충돌이 발생했습니다.',
              code: 'EDIT_CONFLICT',
              serverVersion: currentVersion,
              message: '다른 사용자가 이 용어를 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
            },
            { status: 409 }
          );
        }
    }

    // Execute rollback
    const result = await rollbackService.rollbackField(
      body.glossaryId,
      body.auditLogId,
      user.id,
      userProfile?.name,
      userProfile?.email || user.email
    );

    if (!result.success) {
      const statusCode = result.error?.code === 'EDIT_CONFLICT' ? 409 :
                        result.error?.code === 'RECORD_NOT_FOUND' ? 404 :
                        result.error?.code === 'AUDIT_NOT_FOUND' ? 404 :
                        result.error?.code === 'AUDIT_MISMATCH' ? 409 : 500;

      return NextResponse.json(
        {
          error: result.error?.message || '롤백에 실패했습니다.',
          code: result.error?.code,
          serverVersion: result.error?.serverVersion,
          currentValue: result.error?.currentValue,
          expectedValue: result.error?.expectedValue,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      message: '성공적으로 복구되었습니다.',
      data: {
        glossaryId: result.glossaryId,
        newVersion: result.newVersion,
        revertedField: result.revertedField,
        oldValue: result.oldValue,
        newValue: result.newValue,
      },
    });

  } catch (error) {
    console.error('[API Glossary Revert] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get audit history for a glossary term
 * 
 * Query params:
 * - glossaryId: string (required)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const glossaryId = searchParams.get('glossaryId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    if (!glossaryId) {
      return NextResponse.json(
        { error: '용어 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if user has access to this glossary term
    const { data: glossaryCheck, error: glossaryError } = await supabase
      .from('glossary')
      .select('id')
      .eq('id', glossaryId)
      .single();
    
    if (glossaryError || !glossaryCheck) {
      return NextResponse.json(
        { error: '용어를 찾을 수 없거나 접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    const rollbackService = createGlossaryRollbackService(supabase);
    const history = await rollbackService.getAuditHistory(glossaryId, limit, offset);

    return NextResponse.json({
      success: true,
      data: history,
    });

  } catch (error) {
    console.error('[API Glossary Revert GET] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
