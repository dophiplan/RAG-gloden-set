import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BulkRevertRequest {
  revertItems: {
    translationResultId: string;
    revertText: string;
  }[];
}

// POST - 여러 번역을 한꺼번에 복구
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: BulkRevertRequest = await request.json();
    const { revertItems } = body;

    if (!revertItems?.length) {
      return NextResponse.json(
        { error: '복구할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const item of revertItems) {
      try {
        // 현재 값 조회
        const { data: currentResult } = await supabase
          .from('translation_results')
          .select('translated_text')
          .eq('id', item.translationResultId)
          .single();

        const currentText = currentResult?.translated_text || '';

        // 같은 값이면 스킵
        if (currentText === item.revertText) {
          continue;
        }

        // 복구 로그 생성
        await supabase.from('translation_logs').insert({
          translation_result_id: item.translationResultId,
          previous_text: currentText,
          new_text: item.revertText,
          changed_by: user.id,
        });

        // 번역 결과 업데이트
        const { data: updated, error: updateError } = await supabase
          .from('translation_results')
          .update({
            translated_text: item.revertText,
            reviewer_id: user.id,
            reviewed_at: new Date().toISOString(),
            source_type: 'manual',
          })
          .eq('id', item.translationResultId)
          .select()
          .single();

        if (updateError) throw updateError;
        results.push(updated);
      } catch (err) {
        errors.push({ translationResultId: item.translationResultId, error: err });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}개 항목이 복구되었습니다.`,
      revertedCount: results.length,
      errorCount: errors.length,
    });
  } catch (error) {
    console.error('Error bulk reverting translations:', error);
    return NextResponse.json(
      { error: '복구에 실패했습니다.' },
      { status: 500 }
    );
  }
}
