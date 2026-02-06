import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LanguageCode, ProductCode } from '@/types';

interface ApprovalRequest {
  suggestions: {
    term: string;
    translation: string;
    language_code: LanguageCode;
    context?: string;
    product_codes?: ProductCode[];
  }[];
}

/**
 * POST - 제안된 용어를 승인하여 용어집에 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: ApprovalRequest = await request.json();

    if (!body.suggestions || !Array.isArray(body.suggestions) || body.suggestions.length === 0) {
      return NextResponse.json(
        { error: '승인할 용어가 없습니다.' },
        { status: 400 }
      );
    }

    const addedTerms: string[] = [];
    const errors: { term: string; error: string }[] = [];

    // 각 제안을 용어집에 추가
    for (const suggestion of body.suggestions) {
      try {
        // 유효성 검사
        if (!suggestion.term?.trim() || !suggestion.translation?.trim() || !suggestion.language_code) {
          errors.push({
            term: suggestion.term || 'Unknown',
            error: '용어, 번역, 언어 코드는 필수입니다.',
          });
          continue;
        }

        // 중복 확인 (같은 term, language_code 조합)
        const { data: existing } = await supabase
          .from('glossary')
          .select('id')
          .eq('term', suggestion.term.trim())
          .eq('language_code', suggestion.language_code)
          .single();

        if (existing) {
          errors.push({
            term: suggestion.term,
            error: '이미 등록된 용어입니다.',
          });
          continue;
        }

        // 용어집에 추가
        const { data: glossary, error: insertError } = await supabase
          .from('glossary')
          .insert({
            term: suggestion.term.trim(),
            translation: suggestion.translation.trim(),
            language_code: suggestion.language_code,
            context: suggestion.context?.trim() || null,
            user_id: user.id,
            product_code: null, // 다중 제품 지원을 위해 null로 설정
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // 제품 연결 추가
        if (suggestion.product_codes && suggestion.product_codes.length > 0) {
          const productLinks = suggestion.product_codes.map((code) => ({
            glossary_id: glossary.id,
            product_code: code,
          }));

          const { error: productError } = await supabase
            .from('glossary_products')
            .insert(productLinks);

          if (productError) {
            console.error('Error linking products:', productError);
            // 제품 연결 실패해도 용어는 추가됨
          }
        }

        addedTerms.push(glossary.id);
      } catch (error) {
        console.error(`Error adding term "${suggestion.term}":`, error);
        errors.push({
          term: suggestion.term,
          error: '용어 추가 중 오류가 발생했습니다.',
        });
      }
    }

    return NextResponse.json({
      success: true,
      added: addedTerms.length,
      glossary_ids: addedTerms,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error approving glossary suggestions:', error);
    return NextResponse.json(
      { error: '용어 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
