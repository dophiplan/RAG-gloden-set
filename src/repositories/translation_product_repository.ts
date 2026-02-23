import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationProduct, ProductCode } from '@/types';

export interface TranslationProductCreateData {
  translation_id: string;
  product_code: ProductCode;
  version?: string | null;
  version_updated_at?: string | null;
}

/**
 * Repository for TranslationProduct database operations
 * Handles many-to-many relationship between translations and products
 */
export class TranslationProductRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create translation-product links (bulk insert)
   */
  async createMany(links: TranslationProductCreateData[]): Promise<TranslationProduct[]> {
    if ((links || []).length === 0) return [];

    const { data, error } = await this.supabase
      .from('translation_products')
      .insert(links)
      .select();

    if (error) {
      throw new Error(`Failed to create translation-product links: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find translation-product links by translation ID
   */
  async findByTranslationId(translationId: string): Promise<TranslationProduct[]> {
    const { data, error } = await this.supabase
      .from('translation_products')
      .select('*')
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to find translation-product links: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete translation-product links by translation ID
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('translation_products')
      .delete()
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to delete translation-product links: ${error.message}`);
    }
  }

  /**
   * Update product links for a translation (delete + insert)
   */
  async updateForTranslation(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<TranslationProduct[]> {
    // Delete existing links
    await this.deleteByTranslationId(translationId);

    // Create new links
    if ((productCodes || []).length === 0) return [];

    const links = (productCodes || []).map(code => ({
      translation_id: translationId,
      product_code: code,
    }));

    return this.createMany(links);
  }
}
