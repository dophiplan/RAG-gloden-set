import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reviewTranslationContext, bulkReviewContext } from '@/lib/openai/context-review';
import { GlossaryTerm } from '@/types';

interface SingleReviewInput {
  sourceText: string;
  translatedText: string;
  languageCode: string;
  context?: string;
}

interface BulkReviewInput {
  translations: {
    sourceText: string;
    translatedText: string;
    languageCode: string;
  }[];
}

// POST - Review translation context with AI
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();

    // Fetch glossary terms
    const { data: glossaryTerms, error: glossaryError } = await supabase
      .from('glossary')
      .select('*');

    if (glossaryError) throw glossaryError;

    // Single review
    if (body.sourceText && body.translatedText) {
      const input = body as SingleReviewInput;

      if (!input.languageCode) {
        return NextResponse.json(
          { error: '언어 코드는 필수입니다.' },
          { status: 400 }
        );
      }

      const result = await reviewTranslationContext({
        sourceText: input.sourceText,
        translatedText: input.translatedText,
        languageCode: input.languageCode,
        glossaryTerms: glossaryTerms as GlossaryTerm[],
        context: input.context,
      });

      return NextResponse.json(result);
    }

    // Bulk review
    if (body.translations && Array.isArray(body.translations)) {
      const input = body as BulkReviewInput;

      if (input.translations.length === 0) {
        return NextResponse.json(
          { error: '번역 목록은 필수입니다.' },
          { status: 400 }
        );
      }

      if (input.translations.length > 20) {
        return NextResponse.json(
          { error: '한 번에 최대 20개까지 검토 가능합니다.' },
          { status: 400 }
        );
      }

      const results = await bulkReviewContext({
        translations: input.translations,
        glossaryTerms: glossaryTerms as GlossaryTerm[],
      });

      return NextResponse.json({ results });
    }

    return NextResponse.json(
      { error: '잘못된 요청 형식입니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in AI context check:', error);

    // Check for OpenAI API key error
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'AI 문맥 검토 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
