// Re-export from the new unified AI module for backward compatibility
export {
  translateWithProvider,
  translateWithOpenAI,
  translateWithClaude,
  translateWithKimi,
  translateWithGemini,
} from '@/lib/ai/providers';

export type {
  TranslateInput,
  TranslationResult,
  GlossaryTerm,
  TranslationMemoryEntry,
  CorrectionEntry,
} from '@/lib/ai/providers';

// Legacy autoTranslate function with OpenAI as default
import { translateWithOpenAI, TranslateInput, TranslationResult } from '@/lib/ai/providers';

/**
 * @deprecated Use translateWithProvider with explicit provider selection
 */
export async function autoTranslate(input: TranslateInput): Promise<TranslationResult[]> {
  return translateWithOpenAI(input);
}

// Batch translate for multiple source texts
export async function batchAutoTranslate(
  items: { sourceText: string; context: string | null }[],
  targetLanguages: string[],
  glossaryTerms?: any[],
  translationMemory?: any[],
  corrections?: any[],
  apiKey?: string,
  provider: string = 'openai'
): Promise<Map<string, TranslationResult[]>> {
  const results = new Map<string, TranslationResult[]>();

  if (!apiKey) {
    console.warn('No API key provided for batch translation');
    return results;
  }

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
          const { translateWithProvider } = await import('@/lib/ai/providers');
          const translations = await translateWithProvider(provider as any, {
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
