import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RevertRequest {
  logId: string;
  languageCode: string;
}

// POST - 특정 버전으로 복구
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: translationId } = await params;
    const body: RevertRequest = await request.json();

    if (!body.logId || !body.languageCode) {
      return NextResponse.json(
        { error: '로그 ID와 언어 코드는 필수입니다.' },
        { status: 400 }
      );
    }

    // 복구할 로그 조회
    const { data: log, error: logError } = await supabase
      .from('translation_logs')
      .select('translation_result_id, previous_text')
      .eq('id', body.logId)
      .single();

    if (logError || !log) {
      return NextResponse.json(
        { error: '해당 버전을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 번역 결과 조회 (로그용)
    const { data: currentResult } = await supabase
      .from('translation_results')
      .select('translated_text')
      .eq('id', log.translation_result_id)
      .single();

    const curre[기밀마스킹]ext = currentResult?.translated_text || '';
    const revertText = log.previous_text;

    // 같은 값이면 복구 필요 없음
    if (curre[기밀마스킹]ext === revertText) {
      return NextResponse.json(
        { error: '이미 해당 버전입니다.' },
        { status: 400 }
      );
    }

    // 복구 로그 생성
    await supabase.from('translation_logs').insert({
      translation_result_id: log.translation_result_id,
      previous_text: curre[기밀마스킹]ext,
      new_text: revertText,
      changed_by: user.id,
    });

    // 번역 결과 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('translation_results')
      .update({
        translated_text: revertText,
        reviewer_id: user.id,
        reviewed_at: new Date().toISOString(),
        source_type: 'manual',
      })
      .eq('id', log.translation_result_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: '이전 버전으로 복구되었습니다.',
      data: updated,
    });
  } catch (error) {
    console.error('Error reverting translation:', error);
    return NextResponse.json(
      { error: '복구에 실패했습니다.' },
      { status: 500 }
    );
  }
}
