import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LanguageCode } from '@/types';
import { apiSuccess, apiUnauthorized, apiBadRequest, apiInternalError } from '@/lib/api/response';

interface CorrectionRequest {
  original_text: string;
  corrected_text: string;
  source_text: string;
  language_code: LanguageCode;
}

// POST - Record a correction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const body: CorrectionRequest = await request.json();

    // Validate request
    if (!body.original_text?.trim() || !body.corrected_text?.trim() || !body.source_text?.trim()) {
      return apiBadRequest('필수 필드가 누락되었습니다.');
    }

    if (!body.language_code) {
      return apiBadRequest('언어 코드가 필요합니다.');
    }

    // Don't record if original and corrected are the same
    if (body.original_text.trim() === body.corrected_text.trim()) {
      return apiSuccess({ message: '변경 사항이 없습니다.' });
    }

    // Insert correction
    const { data, error } = await supabase
      .from('translation_corrections')
      .insert({
        original_text: body.original_text.trim(),
        corrected_text: body.corrected_text.trim(),
        source_text: body.source_text.trim(),
        language_code: body.language_code,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess(data);
  } catch (error) {
    console.error('Error recording correction:', error);
    return apiInternalError('수정 이력을 저장하는데 실패했습니다.');
  }
}

// GET - Fetch corrections for a specific language
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('language_code');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('translation_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    const { data, error } = await query;

    if (error) throw error;

    return apiSuccess({ corrections: data });
  } catch (error) {
    console.error('Error fetching corrections:', error);
    return apiInternalError('수정 이력을 불러오는데 실패했습니다.');
  }
}
