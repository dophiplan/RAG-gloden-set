import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiInternalError } from '@/lib/api/response';

interface FigmaText {
  id: string;
  text: string;
  characters: string;
}

interface TranslateRequest {
  texts: FigmaText[];
  targetLang: string;
}

// POST - 피그마 텍스트 번역
export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { texts, targetLang } = body;

    if (!texts || texts.length === 0) {
      return apiError('번역할 텍스트가 없습니다.', 400);
    }

    // TODO: AI 번역 서비스 연동
    // 현재는 mock 응답
    const translations = texts.map(item => ({
      id: item.id,
      original: item.characters,
      translated: `[${targetLang.toUpperCase()}] ${item.characters}`,
      confidence: 0.95
    }));

    return apiSuccess({
      translations,
      total: texts.length,
      targetLang
    });

  } catch (error) {
    console.error('Figma translation error:', error);
    return apiInternalError('번역 중 오류가 발생했습니다.');
  }
}
