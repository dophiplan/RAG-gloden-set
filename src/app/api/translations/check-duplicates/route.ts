import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateSimilarity, isExactMatch } from '@/shared/text_processing/text_similarity_calculator';
import { DuplicateCheckResult, Translation, TranslationResult } from '@/types';

interface CheckDuplicatesInput {
  texts: string[];
}

// POST - Check for duplicate translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: CheckDuplicatesInput = await request.json();

    if (!body.texts || body.texts.length === 0) {
      return NextResponse.json(
        { error: '텍스트 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    // Fetch all existing translations
    const { data: existingTranslations, error } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*)
      `);

    if (error) throw error;

    const results: DuplicateCheckResult[] = body.texts.map((text) => {
      // Check for exact match first
      const exactMatch = existingTranslations?.find((t: Translation) =>
        isExactMatch(t.source_text, text)
      );

      if (exactMatch) {
        return {
          text,
          status: 'exact_match' as const,
          similarity: 1,
          existingTranslation: exactMatch as Translation & { results: TranslationResult[] },
        };
      }

      // Check for similar texts (80%+ similarity)
      let bestSimilarity = 0;
      let bestMatch: (Translation & { results: TranslationResult[] }) | undefined;

      existingTranslations?.forEach((t: Translation & { results: TranslationResult[] }) => {
        const similarity = calculateSimilarity(text, t.source_text);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = t;
        }
      });

      if (bestSimilarity >= 0.8 && bestMatch) {
        return {
          text,
          status: 'similar' as const,
          similarity: bestSimilarity,
          existingTranslation: bestMatch,
        };
      }

      // New text
      return {
        text,
        status: 'new' as const,
      };
    });

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        exactMatches: results.filter((r) => r.status === 'exact_match').length,
        similar: results.filter((r) => r.status === 'similar').length,
        new: results.filter((r) => r.status === 'new').length,
      },
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json(
      { error: '중복 검사 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
