import { getAnthropicClient } from './client';
import { SUPPORTED_LANGUAGES, LanguageCode, GlossaryTerm } from '@/types';

interface TranslationMemoryEntry {
  source_text: string;
  translated_text: string;
  language_code: string;
}

interface CorrectionEntry {
  original_text: string;
  corrected_text: string;
  source_text: string;
  language_code: string;
}

interface AutoTranslateInput {
  sourceText: string;
  context: string | null;
  targetLanguages: LanguageCode[];
  glossaryTerms?: GlossaryTerm[];
  translationMemory?: TranslationMemoryEntry[];
  corrections?: CorrectionEntry[];
  apiKey?: string;
}

interface TranslationResult {
  languageCode: LanguageCode;
  translatedText: string;
}

export async function autoTranslate(input: AutoTranslateInput): Promise<TranslationResult[]> {
  const anthropic = getAnthropicClient(input.apiKey);

  // Build glossary context by language
  const glossaryByLanguage: Record<string, string[]> = {};
  if (input.glossaryTerms && input.glossaryTerms.length > 0) {
    input.glossaryTerms.forEach((term) => {
      if (!glossaryByLanguage[term.language_code]) {
        glossaryByLanguage[term.language_code] = [];
      }
      glossaryByLanguage[term.language_code].push(
        `"${term.term}" → "${term.translation}"${term.context ? ` (${term.context})` : ''}`
      );
    });
  }

  // Build translation memory context by language
  const memoryByLanguage: Record<string, string[]> = {};
  if (input.translationMemory && input.translationMemory.length > 0) {
    input.translationMemory.forEach((entry) => {
      if (!memoryByLanguage[entry.language_code]) {
        memoryByLanguage[entry.language_code] = [];
      }
      memoryByLanguage[entry.language_code].push(
        `"${entry.source_text}" → "${entry.translated_text}"`
      );
    });
  }

  // Build corrections context by language
  const correctionsByLanguage: Record<string, string[]> = {};
  if (input.corrections && input.corrections.length > 0) {
    input.corrections.forEach((entry) => {
      if (!correctionsByLanguage[entry.language_code]) {
        correctionsByLanguage[entry.language_code] = [];
      }
      correctionsByLanguage[entry.language_code].push(
        `When "${entry.source_text}" was translated as "${entry.original_text}", it was corrected to "${entry.corrected_text}"`
      );
    });
  }

  // Generate system prompt
  const systemPrompt = `You are a professional translator specializing in Korean to multiple languages translation.

RULES:
1. Translate the given Korean text accurately while maintaining natural expression in each target language.
2. Preserve the original tone and intent.
3. Use the provided glossary terms consistently.
4. Learn from previous corrections and apply similar patterns.
5. Consider the translation memory for consistency with existing translations.

${Object.entries(glossaryByLanguage).length > 0 ? `GLOSSARY (you MUST follow these translations):
${Object.entries(glossaryByLanguage)
  .map(([lang, terms]) => `[${lang}]\n${terms.join('\n')}`)
  .join('\n\n')}` : ''}

${Object.entries(memoryByLanguage).length > 0 ? `TRANSLATION MEMORY (reference for consistency):
${Object.entries(memoryByLanguage)
  .map(([lang, entries]) => `[${lang}]\n${entries.slice(0, 10).join('\n')}`)
  .join('\n\n')}` : ''}

${Object.entries(correctionsByLanguage).length > 0 ? `PREVIOUS CORRECTIONS (learn from these patterns):
${Object.entries(correctionsByLanguage)
  .map(([lang, entries]) => `[${lang}]\n${entries.slice(0, 5).join('\n')}`)
  .join('\n\n')}` : ''}

Respond ONLY in JSON format:
{
  "translations": [
    {"languageCode": "en", "translatedText": "..."},
    {"languageCode": "ja", "translatedText": "..."}
  ]
}`;

  const targetLangNames = input.targetLanguages
    .map((code) => `${SUPPORTED_LANGUAGES[code]} (${code})`)
    .join(', ');

  const userPrompt = `Translate the following Korean text to: ${targetLangNames}

Korean text: "${input.sourceText}"
${input.context ? `Context/Usage: ${input.context}` : ''}

Please provide translations for ALL specified languages.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.translations || !Array.isArray(result.translations)) {
      throw new Error('Invalid response format from Claude');
    }

    // Validate and filter results
    const validResults: TranslationResult[] = result.translations
      .filter(
        (t: { languageCode?: string; translatedText?: string }) =>
          t.languageCode &&
          t.translatedText &&
          input.targetLanguages.includes(t.languageCode as LanguageCode)
      )
      .map((t: { languageCode: string; translatedText: string }) => ({
        languageCode: t.languageCode as LanguageCode,
        translatedText: t.translatedText,
      }));

    return validResults;
  } catch (error) {
    console.error('Error in auto-translate:', error);
    throw error;
  }
}

// Batch translate for multiple source texts
export async function batchAutoTranslate(
  items: { sourceText: string; context: string | null }[],
  targetLanguages: LanguageCode[],
  glossaryTerms?: GlossaryTerm[],
  translationMemory?: TranslationMemoryEntry[],
  corrections?: CorrectionEntry[],
  apiKey?: string
): Promise<Map<string, TranslationResult[]>> {
  const results = new Map<string, TranslationResult[]>();

  // Process in parallel with a concurrency limit
  const concurrencyLimit = 3;
  const chunks: typeof items[] = [];

  for (let i = 0; i < items.length; i += concurrencyLimit) {
    chunks.push(items.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        try {
          const translations = await autoTranslate({
            sourceText: item.sourceText,
            context: item.context,
            targetLanguages,
            glossaryTerms,
            translationMemory,
            corrections,
            apiKey,
          });
          return { sourceText: item.sourceText, translations };
        } catch (error) {
          console.error(`Error translating "${item.sourceText}":`, error);
          return { sourceText: item.sourceText, translations: [] };
        }
      })
    );

    chunkResults.forEach(({ sourceText, translations }) => {
      results.set(sourceText, translations);
    });
  }

  return results;
}
