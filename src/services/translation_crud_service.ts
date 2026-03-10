import { SupabaseClient } from '@supabase/supabase-js';
import {
  TranslationRepository,
  TranslationResultRepository,
  TranslationProductRepository,
  TranslationFilters,
  PaginationParams,
  TranslationCreateData,
  TranslationResultCreateData,
  TranslationProductCreateData,
} from '@/repositories';
import { Translation, TranslationStatus, ProductCode, LanguageCode, PriorityLevel, ScopeType } from '@/types';
import { GlossaryAutoMatcher } from './glossary_auto_matcher';
import { TranslationAuditLogger } from './translation_audit_logger';

export interface TranslationCreateInput {
  sourceText: string;
  context?: string;
  version?: string;
  productCode?: ProductCode;
  productCodes?: ProductCode[];
  scope?: ScopeType;
  priority?: PriorityLevel;
  completionDate?: string;
  userId: string;
  platformCodes?: string[];
  translations?: Array<{
    languageCode: LanguageCode;
    translatedText: string;
  }>;
}

export interface TranslationListResponse {
  translations: (Translation & { last_audit?: any })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Service for Translation CRUD operations
 * Orchestrates multiple repositories and handles business logic
 */
export class TranslationCrudService {
  private translationRepo: TranslationRepository;
  private resultRepo: TranslationResultRepository;
  private productRepo: TranslationProductRepository;
  private glossaryMatcher: GlossaryAutoMatcher;
  private auditLogger: TranslationAuditLogger;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.translationRepo = new TranslationRepository(supabase);
    this.resultRepo = new TranslationResultRepository(supabase);
    this.productRepo = new TranslationProductRepository(supabase);
    this.glossaryMatcher = new GlossaryAutoMatcher(supabase);
    this.auditLogger = new TranslationAuditLogger(supabase);
  }

  /**
   * Get paginated list of translations with filters
   */
  async getTranslationsList(
    filters: TranslationFilters,
    pagination: PaginationParams
  ): Promise<TranslationListResponse> {
    // Fetch translations with filters and pagination
    const { data: translations, count } = await this.translationRepo.findMany(
      filters,
      pagination
    );

    // Fetch latest audit logs for the translations
    const translationIds = (translations || []).map(t => t.id);
    const auditsMap = await this.auditLogger.getLatestLogs(translationIds);

    // Add last_audit to each translation
    const translationsWithAudit = (translations || []).map(t => ({
      ...t,
      last_audit: auditsMap.get(t.id) || null,
    }));

    return {
      translations: translationsWithAudit,
      total: count || 0,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil((count || 0) / pagination.limit),
    };
  }

  /**
   * Get a single translation by ID
   */
  async getTranslation(id: string): Promise<Translation | null> {
    return this.translationRepo.findById(id);
  }

  /**
   * Create a new translation with optional translations and product links
   */
  async createTranslation(
    input: TranslationCreateInput,
    userProfile?: { name?: string | null; email: string }
  ): Promise<Translation> {
    const {
      sourceText,
      context,
      version,
      productCode,
      productCodes,
      scope,
      priority,
      completionDate,
      userId,
      platformCodes,
      translations: inputTranslations,
    } = input;

    // Apply glossary matching if translations are provided
    let translationsToCreate = inputTranslations || [];

    if ((translationsToCreate || []).length > 0) {
      const languageCodes = (translationsToCreate || []).map(t => t.languageCode);
      const glossaryMatches = await this.glossaryMatcher.findMatches(
        sourceText,
        languageCodes,
        productCode || productCodes?.[0]
      );

      // Auto-fill empty translations with glossary matches
      translationsToCreate = this.glossaryMatcher.applyMatchesToInput(
        (translationsToCreate || []).map(t => ({
          language_code: t.languageCode,
          translated_text: t.translatedText,
        })),
        glossaryMatches
      ) as any;
    }

    // Create translation
    const translationData: TranslationCreateData = {
      source_text: sourceText,
      context: context || null,
      version: version || null,
      version_updated_at: version ? new Date().toISOString() : null,
      product_code: productCode || null,
      scope: scope || null,
      priority: priority || 'medium',
      completion_date: completionDate || null,
      user_id: userId,
      status: 'pending',
    };

    const translation = await this.translationRepo.create(translationData);

    // Create audit log (non-blocking)
    void this.auditLogger.logCreation({
      translationId: translation.id,
      userId,
      userName: userProfile?.name,
      userEmail: userProfile?.email || '',
      sourceText,
    });

    // Create translation results if provided
    if ((translationsToCreate || []).length > 0) {
      const resultsData: TranslationResultCreateData[] = (translationsToCreate as any)
        .filter((t: any) => t.translated_text && t.translated_text.trim().length > 0)
        .map((t: any) => ({
          translation_id: translation.id,
          language_code: t.language_code,
          translated_text: t.translated_text,
          reviewer_id: userId,
          reviewed_at: new Date().toISOString(),
          source_type: t.source_type || 'manual',
          glossary_term_id: t.glossary_term_id || null,
        }));

      if ((resultsData || []).length > 0) {
        await this.resultRepo.createMany(resultsData);
      }
    }

    // Create product links
    const productCodesToLink = productCodes || (productCode ? [productCode] : []);
    if ((productCodesToLink || []).length > 0) {
      const productLinks: TranslationProductCreateData[] = (productCodesToLink || []).map(code => ({
        translation_id: translation.id,
        product_code: code,
        version: version || null,
        version_updated_at: version ? new Date().toISOString() : null,
      }));

      await this.productRepo.createMany(productLinks);
    }

    // Create platform links if provided
    if ((platformCodes || []).length > 0) {
      const platformLinks = (platformCodes || []).map(platformCode => ({
        translation_id: translation.id,
        platform_code: platformCode,
      }));
      
      await this.supabase
        .from('translation_platforms')
        .insert(platformLinks);
    }

    // Fetch complete translation with relations
    const completeTranslation = await this.translationRepo.findById(translation.id);
    return completeTranslation!;
  }

  /**
   * Update a translation
   */
  async updateTranslation(
    id: string,
    updates: Partial<Translation>,
    userInfo?: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<Translation> {
    // Get current translation for audit logging
    const curre[기밀마스킹]ranslation = await this.translationRepo.findById(id);
    if (!curre[기밀마스킹]ranslation) {
      throw new Error('Translation not found');
    }

    // Update translation
    const updated = await this.translationRepo.update(id, updates);

    // Log update if user info provided
    if (userInfo) {
      // Log each changed field
      Object.keys(updates).forEach(key => {
        const oldValue = (curre[기밀마스킹]ranslation as any)[key];
        const newValue = (updates as any)[key];

        if (oldValue !== newValue) {
          void this.auditLogger.logUpdate({
            translationId: id,
            userId: userInfo.userId,
            userName: userInfo.userName,
            userEmail: userInfo.userEmail,
            fieldName: key,
            oldValue: String(oldValue),
            newValue: String(newValue),
          });
        }
      });
    }

    return updated;
  }

  /**
   * Update translation status
   */
  async updateStatus(
    id: string,
    status: TranslationStatus,
    userInfo: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<Translation> {
    return this.updateTranslation(
      id,
      { status, updated_at: new Date().toISOString() },
      userInfo
    );
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(
    id: string,
    userInfo: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<void> {
    // Get translation for audit log
    const translation = await this.translationRepo.findById(id);
    if (!translation) {
      throw new Error('Translation not found');
    }

    // Delete translation (cascades to results and products)
    await this.translationRepo.delete(id);

    // Log deletion (non-blocking)
    void this.auditLogger.logDeletion({
      translationId: id,
      userId: userInfo.userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
      sourceText: translation.source_text,
    });
  }

  /**
   * Bulk update translation status
   */
  async bulkUpdateStatus(
    ids: string[],
    status: TranslationStatus
  ): Promise<void> {
    await this.translationRepo.bulkUpdateStatus(ids, status);
  }

  /**
   * Update translation result (translated text)
   */
  async updateTranslationResult(
    translationId: string,
    languageCode: LanguageCode,
    translatedText: string,
    reviewerId: string
  ): Promise<void> {
    await this.resultRepo.upsert({
      translation_id: translationId,
      language_code: languageCode,
      translated_text: translatedText,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      source_type: 'manual',
    });
  }
}
