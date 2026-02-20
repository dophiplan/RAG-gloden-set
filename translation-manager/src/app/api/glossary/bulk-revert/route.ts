import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGlossaryRollbackService } from '@/services/glossary_rollback_service';
import type { BulkRollbackItem } from '@/services/glossary_rollback_service';

interface BulkRevertRequest {
  items: Array<{
    glossaryId: string;
    auditLogId: string;
    expectedVersion?: number;
  }>;
  atomic?: boolean; // If true, all must succeed or none
}

/**
 * POST - Bulk revert multiple glossary terms
 * 
 * Request body:
 * {
 *   items: Array<{
 *     glossaryId: string;
 *     auditLogId: string;
 *     expectedVersion?: number;
 *   }>;
 *   atomic?: boolean; // default: false
 * }
 */
export async function POST(request: NextRequest) {
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
      console.error('[API Glossary Bulk Revert] Failed to fetch user profile:', profileError);
    }

    const body: BulkRevertRequest = await request.json();

    // Validate request
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: '롤백할 항목을 선택해주세요.' },
        { status: 400 }
      );
    }

    // Limit bulk size to prevent abuse
    if (body.items.length > 100) {
      return NextResponse.json(
        { error: '한 번에 최대 100개까지 롤백할 수 있습니다.' },
        { status: 400 }
      );
    }

    // Check access permissions for all items
    const glossaryIds = [...new Set(body.items.map(item => item.glossaryId))];
    const { data: accessibleGlossaries, error: accessError } = await supabase
      .from('glossary')
      .select('id')
      .in('id', glossaryIds);
    
    if (accessError || !accessibleGlossaries || accessibleGlossaries.length !== glossaryIds.length) {
      const accessibleIds = new Set(accessibleGlossaries?.map(g => g.id) || []);
      const inaccessibleIds = glossaryIds.filter(id => !accessibleIds.has(id));
      
      return NextResponse.json(
        { 
          error: '일부 용어에 접근 권한이 없습니다.',
          inaccessibleIds: inaccessibleIds,
        },
        { status: 403 }
      );
    }

    const rollbackService = createGlossaryRollbackService(supabase);

    // Convert request items to service format
    const items: BulkRollbackItem[] = body.items.map(item => ({
      glossaryId: item.glossaryId,
      auditLogId: item.auditLogId,
      expectedVersion: item.expectedVersion,
    }));

    // Execute bulk rollback
    const result = await rollbackService.bulkRollback(
      items,
      user.id,
      userProfile?.name,
      userProfile?.email || user.email,
      body.atomic || false
    );

    // Determine response status
    const hasConflicts = result.summary.conflicts > 0;
    const hasFailures = result.summary.failed > 0;
    const allSuccess = result.allSuccess;

    // Build response
    const response: {
      success: boolean;
      message: string;
      data: {
        results: typeof result.results;
        summary: typeof result.summary;
      };
      conflicts?: Array<{
        glossaryId: string;
        currentValue?: string;
        expectedValue?: string;
        serverVersion?: number;
      }>;
    } = {
      success: allSuccess,
      message: allSuccess
        ? `${result.summary.success}개 항목을 성공적으로 복구했습니다.`
        : `${result.summary.success}/${result.summary.total}개 복구 완료. ${result.summary.failed}개 실패.`,
      data: {
        results: result.results,
        summary: result.summary,
      },
    };

    // Add conflict details if any
    if (hasConflicts) {
      response.conflicts = result.results
        .filter(r => !r.success && r.error?.code === 'EDIT_CONFLICT')
        .map(r => ({
          glossaryId: r.glossaryId,
          currentValue: r.error?.currentValue,
          expectedValue: r.error?.expectedValue,
          serverVersion: r.error?.serverVersion,
        }));
    }

    // Status code
    // 200: Partial success or all success
    // 409: Has conflicts
    // 500: Other errors
    const statusCode = hasConflicts ? 409 : 
                      (hasFailures && !hasConflicts) ? 500 : 200;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('[API Glossary Bulk Revert] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
