import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { glossaryBulkApproveSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';

interface BulkApproveInput {
  ids: string[];
  action: 'approve' | 'reject';
}

// PATCH - Bulk approve or reject glossary terms
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Use transaction-safe SQL function for atomic bulk operation
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

    return NextResponse.json({
      success: true,
      updated: result.success_count || 0,
      failed: result.failed_count || 0,
    });
  } catch (error) {
    console.error('Error bulk approving/rejecting glossary terms:', error);
    return NextResponse.json(
      { error: '일괄 승인/거부에 실패했습니다.' },
      { status: 500 }
    );
  }
}
