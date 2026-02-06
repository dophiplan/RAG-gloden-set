import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai/client';
import { LanguageCode } from '@/types';

interface GenerateContextRequest {
  term: string;
  translation: string;
  language_code: LanguageCode;
  sample_contexts?: string[];
}

/**
 * POST - AI를 사용하여 용어에 대한 설명 자동 생성
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: GenerateContextRequest = await request.json();

    if (!body.term || !body.translation || !body.language_code) {
      return NextResponse.json(
        { error: '용어, 번역, 언어 코드는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 설정에서 API 키 가져오기
    const { data: settings } = await supabase
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .single();

    const openai = getOpenAIClient(settings?.openai_api_key);

    // AI 프롬프트 구성
    const systemPrompt = `You are a professional translator and terminology expert.
Your task is to generate concise, helpful context descriptions for glossary terms.

The description should:
1. Explain when and how to use the term
2. Clarify any nuances or preferences
3. Provide usage guidelines if relevant
4. Be concise (2-4 sentences maximum)
5. Be written in Korean for easy understanding by Korean translators

Do not:
- Simply repeat what the term means
- Be overly verbose
- Include unnecessary technical jargon`;

    const sampleContextsText = body.sample_contexts && body.sample_contexts.length > 0
      ? `\n\nUsage examples:\n${body.sample_contexts.map((ctx, i) => `${i + 1}. "${ctx}"`).join('\n')}`
      : '';

    const userPrompt = `Generate a context description for this glossary term:

Korean term: "${body.term}"
${body.language_code} translation: "${body.translation}"${sampleContextsText}

Please provide a concise description in Korean that explains when and how to use this translation.`;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const generatedContext = response.choices[0]?.message?.content?.trim();

    if (!generatedContext) {
      throw new Error('No response from OpenAI');
    }

    return NextResponse.json({
      context: generatedContext,
    });
  } catch (error) {
    console.error('Error generating context:', error);
    return NextResponse.json(
      { error: '설명 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
