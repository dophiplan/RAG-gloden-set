import { SupabaseClient } from '@supabase/supabase-js';
import { Translation } from '@/types';
import { calculateSimilarity } from '@/lib/similarity';

export interface DuplicateMatch {
  translation: Translation;
  similarity: number;
  matchType: 'exact' | 'similar';
}

/**
 * Service for detecting duplicate translations
 * Uses both exact matching and similarity scoring
 */
export class DuplicateDetector {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find duplicate translations for a given source text
   * Returns both exact matches and similar texts
   */
  async findDuplicates(
    sourceText: string,
    options: {
      excludeId?: string; // Exclude this translation ID from results
      similarityThreshold?: number; // Minimum similarity score (0-1)
      limit?: number; // Max number of results
    } = {}
  ): Promise<DuplicateMatch[]> {
    const {
      excludeId,
      similarityThreshold = 0.8,
      limit = 10,
    } = options;

    // Normalize input for comparison
    const normalizedInput = sourceText.toLowerCase().trim();

    // Query for potential duplicates
    // First, get exact and near-exact matches using database
    let query = this.supabase
      .from('translations')
      .select('*')
      .or(`source_text.eq.${sourceText},source_text.ilike.%${sourceText}%`)
      .limit(50); // Get more than needed, will filter by similarity

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: candidates, error } = await query;

    if (error) {
      console.error('[DuplicateDetector] Error fetching candidates:', error);
      return [];
    }

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // Calculate similarity for each candidate
    const matches: DuplicateMatch[] = candidates
      .map(translation => {
        const candidateText = translation.source_text.toLowerCase().trim();

        // Check for exact match first
        if (candidateText === normalizedInput) {
          return {
            translation,
            similarity: 1,
            matchType: 'exact' as const,
          };
        }

        // Calculate similarity
        const similarity = calculateSimilarity(normalizedInput, candidateText);

        if (similarity >= similarityThreshold) {
          return {
            translation,
            similarity,
            matchType: 'similar' as const,
          };
        }

        return null;
      })
      .filter((match): match is DuplicateMatch => match !== null)
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity descending
      .slice(0, limit);

    return matches;
  }

  /**
   * Check if a source text has exact duplicates
   */
  async hasExactDuplicate(
    sourceText: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('translations')
      .select('id', { count: 'exact', head: true })
      .eq('source_text', sourceText);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[DuplicateDetector] Error checking exact duplicate:', error);
      return false;
    }

    return (count || 0) > 0;
  }

  /**
   * Find similar translations across a batch of source texts
   * Useful for bulk import validation
   */
  async findBatchDuplicates(
    sourceTexts: string[],
    similarityThreshold: number = 0.8
  ): Promise<Map<string, DuplicateMatch[]>> {
    const results = new Map<string, DuplicateMatch[]>();

    // Process in batches to avoid too many concurrent queries
    const batchSize = 10;
    for (let i = 0; i < sourceTexts.length; i += batchSize) {
      const batch = sourceTexts.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(text =>
          this.findDuplicates(text, { similarityThreshold, limit: 5 })
        )
      );

      batch.forEach((text, index) => {
        results.set(text, batchResults[index]);
      });
    }

    return results;
  }

  /**
   * Get duplicate statistics for reporting
   */
  async getDuplicateStats(): Promise<{
    totalTranslations: number;
    exactDuplicates: number;
    duplicateGroups: number;
  }> {
    // Get total count
    const { count: totalCount } = await this.supabase
      .from('translations')
      .select('*', { count: 'exact', head: true });

    // Find exact duplicates by grouping by source_text
    const { data: duplicateGroups } = await this.supabase
      .from('translations')
      .select('source_text')
      .limit(1000); // Limit for performance

    if (!duplicateGroups) {
      return {
        totalTranslations: totalCount || 0,
        exactDuplicates: 0,
        duplicateGroups: 0,
      };
    }

    // Count duplicate groups
    const textCounts = new Map<string, number>();
    duplicateGroups.forEach(item => {
      const count = textCounts.get(item.source_text) || 0;
      textCounts.set(item.source_text, count + 1);
    });

    const duplicateGroupsCount = Array.from(textCounts.values()).filter(
      count => count > 1
    ).length;

    const exactDuplicatesCount = Array.from(textCounts.values())
      .filter(count => count > 1)
      .reduce((sum, count) => sum + count, 0);

    return {
      totalTranslations: totalCount || 0,
      exactDuplicates: exactDuplicatesCount,
      duplicateGroups: duplicateGroupsCount,
    };
  }
}
