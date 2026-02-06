import { getOpenAIClient } from './client';
import { GlossaryTerm, AIContextReviewResult } from '@/types';

interface ContextReviewInput {
  sourceText: string;
  translatedText: string;
  languageCode: string;
  glossaryTerms: GlossaryTerm[];
  context?: string;
}

export async function reviewTranslationContext(
  input: ContextReviewInput
): Promise<AIContextReviewResult> {
  const openai = getOpenAIClient();

  // Build glossary context
  const glossaryContext = input.glossaryTerms
    .filter((term) => term.language_code === input.languageCode)
    .map((term) => `- "${term.term}" → "${term.translation}"${term.context ? ` (${term.context})` : ''}`)
    .join('\n');

  const systemPrompt = `You are a translation quality reviewer. Your task is to check if a translation follows the terminology and style guidelines.

${glossaryContext ? `GLOSSARY (must follow these translations):
${glossaryContext}` : 'No glossary terms defined.'}

Review the translation for:
1. Terminology consistency - Are glossary terms translated correctly?
2. Tone consistency - Is the tone appropriate (formal/informal)?
3. Brand voice - Does it match typical product/service language?

Respond in JSON format:
{
  "issues": [
    {
      "type": "terminology" | "tone" | "brand",
      "description": "description of the issue",
      "suggestion": "suggested fix",
      "severity": "warning" | "error"
    }
  ],
  "isConsistent": true/false
}

If no issues found, return: {"issues": [], "isConsistent": true}`;

  const userPrompt = `Source text: "${input.sourceText}"
Translated text (${input.languageCode}): "${input.translatedText}"
${input.context ? `Context: ${input.context}` : ''}

Please review this translation for consistency issues.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);

    return {
      text: input.translatedText,
      issues: result.issues || [],
      isConsistent: result.isConsistent ?? true,
    };
  } catch (error) {
    console.error('Error reviewing translation context:', error);
    throw error;
  }
}

interface BulkReviewInput {
  translations: {
    sourceText: string;
    translatedText: string;
    languageCode: string;
  }[];
  glossaryTerms: GlossaryTerm[];
}

export async function bulkReviewContext(
  input: BulkReviewInput
): Promise<AIContextReviewResult[]> {
  const openai = getOpenAIClient();

  // Build glossary context grouped by language
  const glossaryByLanguage: Record<string, string> = {};
  input.glossaryTerms.forEach((term) => {
    if (!glossaryByLanguage[term.language_code]) {
      glossaryByLanguage[term.language_code] = '';
    }
    glossaryByLanguage[term.language_code] +=
      `- "${term.term}" → "${term.translation}"${term.context ? ` (${term.context})` : ''}\n`;
  });

  const systemPrompt = `You are a translation quality reviewer. Review multiple translations for consistency.

GLOSSARY BY LANGUAGE:
${Object.entries(glossaryByLanguage)
  .map(([lang, terms]) => `[${lang}]\n${terms}`)
  .join('\n')}

For each translation, check:
1. Terminology consistency - Are glossary terms translated correctly?
2. Tone consistency - Is the tone appropriate?
3. Brand voice - Does it match typical product language?

Respond in JSON format:
{
  "results": [
    {
      "index": 0,
      "issues": [...],
      "isConsistent": true/false
    }
  ]
}`;

  const translationsList = input.translations
    .map((t, i) => `${i}. Source: "${t.sourceText}" → ${t.languageCode}: "${t.translatedText}"`)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Review these translations:\n${translationsList}` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    return input.translations.map((t, i) => {
      const result = parsed.results?.find((r: { index: number }) => r.index === i);
      return {
        text: t.translatedText,
        issues: result?.issues || [],
        isConsistent: result?.isConsistent ?? true,
      };
    });
  } catch (error) {
    console.error('Error bulk reviewing translations:', error);
    throw error;
  }
}
