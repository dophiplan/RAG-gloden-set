import { SupabaseClient } from '@supabase/supabase-js';
import { GlossaryRepository } from '@/repositories';
import { LanguageCode, ProductCode } from '@/types';

export interface GlossaryMatch {
  languageCode: LanguageCode;
  translatedText: string;
  glossaryTermId: string | null;
  sourceType: 'glossary';
}

/**
 * Service for automatic glossary term matching
 * Handles term lookup and hit count tracking
 */
export class GlossaryAutoMatcher {
  private glossaryRepo: GlossaryRepository;

  constructor(supabase: SupabaseClient) {
    this.glossaryRepo = new GlossaryRepository(supabase);
  }

  /**
   * Find glossary matches for a source text in multiple languages
   * Returns translations that can be auto-filled
   */
  async findMatches(
    sourceText: string,
    targetLanguages: LanguageCode[],
    productCode?: ProductCode
  ): Promise<GlossaryMatch[]> {
    if (targetLanguages.length === 0) {
      return [];
    }

    const matches = await this.glossaryRepo.findExactMatches({
      term: sourceText,
      languageCodes: targetLanguages,
      productCode,
      approvalStatus: 'approved', // Only use approved terms
    });

    if (matches.length === 0) {
      return [];
    }

    // Increment hit counts asynchronously (non-blocking)
    matches.forEach(match => {
      void this.glossaryRepo.incrementHitCount(match.term, match.language_code);
    });

    // Convert to GlossaryMatch format
    return matches.map(match => ({
      languageCode: match.language_code,
      translatedText: match.translation,
      glossaryTermId: match.id,
      sourceType: 'glossary' as const,
    }));
  }

  /**
   * Apply glossary matches to translation input
   * Auto-fills empty translations with glossary matches
   */
  applyMatchesToInput(
    translations: Array<{ language_code: LanguageCode; translated_text: string }>,
    matches: GlossaryMatch[]
  ): Array<{
    language_code: LanguageCode;
    translated_text: string;
    source_type?: 'glossary';
    glossary_term_id?: string | null;
  }> {
    return translations.map(tr => {
      // Find matching glossary entry
      const match = matches.find(m => m.languageCode === tr.language_code);

      // Auto-fill if translation is empty and match exists
      if (match && !tr.translated_text) {
        return {
          language_code: tr.language_code,
          translated_text: match.translatedText,
          source_type: 'glossary' as const,
          glossary_term_id: match.glossaryTermId,
        };
      }

      return tr;
    });
  }

  /**
   * Check if source text has any approved glossary terms
   */
  async hasGlossaryMatch(
    sourceText: string,
    languageCode: LanguageCode,
    productCode?: ProductCode
  ): Promise<boolean> {
    const matches = await this.glossaryRepo.findExactMatches({
      term: sourceText,
      languageCodes: [languageCode],
      productCode,
      approvalStatus: 'approved',
    });

    return matches.length > 0;
  }
}
