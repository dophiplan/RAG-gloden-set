import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IssueType, ProductCode } from '@/types';

// GET - List issues
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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

    return NextResponse.json({ issues });

  } catch (error: any) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: error.message || '이슈 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST - Create new issue
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
      return NextResponse.json(
        { error: '이슈 타입과 설명이 필요합니다.' },
        { status: 400 }
      );
    }

    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        product_code,
        issue_type,
        description,
        file_names,
        user_id: user.id,
        resolved: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ issue }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { error: error.message || '이슈 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
