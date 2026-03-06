import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IssueType, ProductCode } from '@/types';
import { apiSuccess, apiUnauthorized, apiBadRequest, apiInternalError } from '@/lib/api/response';

// GET - List issues
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development mode bypass
    if ((authError || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
      console.warn('⚠️  DEV MODE: Auth bypass enabled for /api/issues');
      // Continue without auth check
    } else if (authError || !user) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const product_code = searchParams.get('product_code') as ProductCode | null;
    const issue_type = searchParams.get('issue_type') as IssueType | null;
    const resolved = searchParams.get('resolved');

    let query = supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (product_code) {
      query = query.eq('product_code', product_code);
    }

    if (issue_type) {
      query = query.eq('issue_type', issue_type);
    }

    if (resolved !== null) {
      query = query.eq('resolved', resolved === 'true');
    }

    const { data: issues, error } = await query;

    if (error) throw error;

    return apiSuccess({ issues });

  } catch (error: unknown) {
    console.error('Error fetching issues:', error);
    return apiInternalError(error instanceof Error ? error.message : '알 수 없는 오류');
  }
}

// POST - Create new issue
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development mode bypass
    let userId = user?.id;
    if ((authError || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
      console.warn('⚠️  DEV MODE: Auth bypass enabled for /api/issues');
      userId = 'dev-mode-user';
    } else if (authError || !user) {
      return apiUnauthorized();
    }

    const body = await request.json();
    const {
      product_code,
      issue_type,
      description,
      file_names = [],
    } = body as {
      product_code?: ProductCode;
      issue_type: IssueType;
      description: string;
      file_names?: string[];
    };

    if (!issue_type || !description) {
      return apiBadRequest('이슈 타입과 설명이 필요합니다.');
    }

    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        product_code,
        issue_type,
        description,
        file_names,
        user_id: userId,
        resolved: false,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ issue });

  } catch (error: unknown) {
    console.error('Error creating issue:', error);
    return apiInternalError(error instanceof Error ? error.message : '알 수 없는 오류');
  }
}
