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
import { isValidUUID } from '@/lib/validation/uuid';
import { translateWithProvider, AIProvider } from '@/lib/ai';

const RSUPPORT_DOMAIN = 'rsupport.com';

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
    if (!isValidUUID(id)) {
      return null;
    }
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
   * Bulk create translations with AI translation and glossary matching
   */
  async bulkCreateWithAI(
    texts: string[],
    languages: LanguageCode[],
    options: {
      context?: string;
      version?: string;
      productCode?: ProductCode;
      scope?: ScopeType;
      priority?: PriorityLevel;
      completionDate?: string;
      userId: string;
      userEmail: string;
      userName?: string | null;
    }
  ): Promise<{
    translations: Translation[];
    requestId: string;
    warning: string | null;
  }> {
    const requestId = crypto.randomUUID();
    const originalTexts = texts.map(text => text.trim());
    const allLanguages = languages.includes('ko') ? languages : ['ko', ...languages];

    // Create translation records
    const translationRecords = originalTexts.map(text => ({
      source_text: text,
      context: options.context || null,
      version: options.version || null,
      product_code: options.productCode || null,
      scope: options.scope || null,
      priority: options.priority || 'medium',
      user_id: options.userId,
      status: 'pending' as const,
      request_id: requestId,
      completion_date: options.completionDate || null,
    }));

    const { data: createdTranslations, error: insertError } = await this.supabase
      .from('translations')
      .insert(translationRecords)
      .select();

    if (insertError || !createdTranslations) {
      throw new Error(`Failed to create translations: ${insertError?.message}`);
    }

    // Create translation_products links
    if (options.productCode) {
      const productLinks = createdTranslations.map(t => ({
        translation_id: t.id,
        product_code: options.productCode,
      }));
      await this.supabase.from('translation_products').insert(productLinks);
    }

    // Create translation results for each language
    const translationResults = createdTranslations.flatMap((translation, index) =>
      allLanguages.map(lang => ({
        translation_id: translation.id,
        language_code: lang,
        translated_text: lang === 'ko' ? originalTexts[index] : '',
      }))
    );

    await this.supabase.from('translation_results').insert(translationResults);

    // Auto-translate with glossary and AI
    let warning: string | null = null;

    try {
      // Apply glossary translations
      const { data: glossaryTerms } = await this.supabase
        .from('glossary')
        .select('*')
        .eq('approval_status', 'approved')
        .in('language_code', allLanguages);

      if (glossaryTerms && glossaryTerms.length > 0) {
        const glossaryUpdates: any[] = [];

        for (let i = 0; i < createdTranslations.length; i++) {
          const translationId = createdTranslations[i].id;
          const koText = originalTexts[i];

          for (const lang of allLanguages) {
            if (lang === 'ko') continue;

            const term = glossaryTerms.find((g: any) =>
              g.language_code === lang &&
              (g.term === koText || koText.includes(g.term))
            );

            if (term) {
              glossaryUpdates.push({
                translation_id: translationId,
                language_code: lang,
                translated_text: term.translation,
                source_type: 'glossary',
                glossary_term_id: term.id,
              });
            }
          }
        }

        if (glossaryUpdates.length > 0) {
          await this.supabase.from('translation_results').upsert(glossaryUpdates, {
            onConflict: 'translation_id,language_code',
          });
        }
      }

      // AI Translation for remaining empty translations
      const { data: orgSettings } = await this.supabase
        .from('organization_settings')
        .select('*')
        .eq('domain', RSUPPORT_DOMAIN)
        .maybeSingle();

      const providerOrder: AIProvider[] = orgSettings?.settings?.ai_provider_order ||
        ['openai', 'claude', 'kimi', 'gemini'];

      let apiKey: string | null = null;
      let selectedProvider: AIProvider | null = null;

      for (const provider of providerOrder) {
        const keyField = `${provider}_api_key` as keyof typeof orgSettings;
        if (orgSettings?.[keyField]) {
          apiKey = orgSettings[keyField] as string;
          selectedProvider = provider;
          break;
        }
      }

      // Fallback to env variables
      if (!apiKey && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
        selectedProvider = 'openai';
      }
      if (!apiKey && process.env.KIMI_API_KEY) {
        apiKey = process.env.KIMI_API_KEY;
        selectedProvider = 'kimi';
      }

      if (apiKey && selectedProvider) {
        console.log(`🤖 Bulk AI Translation: ${selectedProvider.toUpperCase()}`);

        const filledTranslations = new Set(
          (glossaryTerms || []).map((g: any) => `${g.translation_id}_${g.language_code}`)
        );

        for (let i = 0; i < createdTranslations.length; i++) {
          const translationId = createdTranslations[i].id;
          const koText = originalTexts[i];
          const emptyLanguages = allLanguages.filter(
            lang => lang !== 'ko' && !filledTranslations.has(`${translationId}_${lang}`)
          );

          if (emptyLanguages.length === 0) continue;

          try {
            const aiResults = await translateWithProvider(selectedProvider, {
              sourceText: koText,
              context: options.context || null,
              targetLanguages: emptyLanguages,
              glossaryTerms: glossaryTerms || [],
              apiKey,
            });

            for (const result of aiResults) {
              await this.supabase
                .from('translation_results')
                .upsert({
                  translation_id: translationId,
                  language_code: result.languageCode,
                  translated_text: result.translatedText,
                  source_type: 'ai',
                }, {
                  onConflict: 'translation_id,language_code',
                });
            }
          } catch (aiError) {
            console.error(`AI translation error for "${koText}":`, aiError);
            warning = `${selectedProvider.toUpperCase()} 번역 중 오류가 발생했습니다.`;
          }
        }
      } else {
        warning = 'AI 번역을 사용할 수 없습니다. API 키를 설정해주세요.';
      }
    } catch (autoTransError) {
      console.error('Auto-translation error:', autoTransError);
      warning = '자동 번역 중 오류가 발생했습니다.';
    }

    // Create audit logs
    await this.supabase.from('translation_audit_logs').insert(
      createdTranslations.map(t => ({
        translation_id: t.id,
        user_id: options.userId,
        user_name: options.userName || null,
        user_email: options.userEmail,
        action: 'create',
        new_value: t.source_text,
      }))
    );

    return {
      translations: createdTranslations as Translation[],
      requestId: requestId,
      warning,
    };
  }

  /**
   * Update a translation
   */
  async updateTranslation(
    id: string,
    updates: Partial<Translation>,
    userInfo?: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<Translation> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new Error('Translation not found');
    }
    
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
   * Valid status transitions
   */
  private readonly validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
    pending: ['pending', 'in_progress'],
    in_progress: ['pending', 'in_progress', 'reviewed'],
    reviewed: ['in_progress', 'reviewed', 'deployed'],
    deployed: ['reviewed', 'deployed', 're_deploy_request'],
    re_request: ['pending', 're_request', 'in_progress'],
    re_deploy_request: ['reviewed', 're_deploy_request', 'deployed'],
    not_used: ['not_used', 'pending'],
  };

  /**
   * Validate status transition
   */
  validateStatusTransition(
    currentStatus: TranslationStatus,
    newStatus: TranslationStatus
  ): { valid: boolean; allowedStatuses?: TranslationStatus[]; message?: string } {
    const allowedStatuses = this.validTransitions[currentStatus] || [];
    
    if (!allowedStatuses.includes(newStatus)) {
      return {
        valid: false,
        allowedStatuses,
        message: `현재 "${currentStatus}" 상태에서는 다음 상태로만 변경 가능합니다: ${allowedStatuses.join(', ')}`,
      };
    }
    
    return { valid: true };
  }

  /**
   * Update translation status with validation
   */
  async updateStatus(
    id: string,
    newStatus: TranslationStatus,
    userInfo: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<{ translation: Translation; oldStatus: TranslationStatus }> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new Error('Translation not found');
    }
    
    // Get current translation
    const curre[기밀마스킹]ranslation = await this.translationRepo.findById(id);
    if (!curre[기밀마스킹]ranslation) {
      throw new Error('Translation not found');
    }

    const currentStatus = curre[기밀마스킹]ranslation.status as TranslationStatus;
    
    // Validate transition
    const validation = this.validateStatusTransition(currentStatus, newStatus);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // Update status
    const updated = await this.updateTranslation(
      id,
      { status: newStatus, updated_at: new Date().toISOString() },
      userInfo
    );

    return { translation: updated, oldStatus: currentStatus };
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(
    id: string,
    userInfo: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new Error('Translation not found');
    }
    
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
    status: TranslationStatus,
    userInfo?: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('translations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .select('id');

    if (error) {
      throw new Error(`Failed to bulk update status: ${error.message}`);
    }

    const updatedCount = data?.length || 0;

    // Create audit logs if user info provided
    if (userInfo && updatedCount > 0) {
      const auditLogs = ids.map(id => ({
        translation_id: id,
        user_id: userInfo.userId,
        user_name: userInfo.userName,
        user_email: userInfo.userEmail,
        action: 'update',
        field_name: 'status',
        new_value: status,
      }));

      await this.supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return updatedCount;
  }

  /**
   * Bulk update translation product codes
   */
  async bulkUpdateProductCodes(
    ids: string[],
    productCode: ProductCode,
    userInfo?: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<number> {
    // Delete existing product associations
    const { error: deleteError } = await this.supabase
      .from('translation_products')
      .delete()
      .in('translation_id', ids);

    if (deleteError) {
      throw new Error(`Failed to delete existing products: ${deleteError.message}`);
    }

    // Insert new product associations
    const productLinks = ids.map(id => ({
      translation_id: id,
      product_code: productCode,
    }));

    const { error: insertError } = await this.supabase
      .from('translation_products')
      .insert(productLinks);

    if (insertError) {
      throw new Error(`Failed to insert new products: ${insertError.message}`);
    }

    // Create audit logs if user info provided
    if (userInfo) {
      const auditLogs = ids.map(id => ({
        translation_id: id,
        user_id: userInfo.userId,
        user_name: userInfo.userName,
        user_email: userInfo.userEmail,
        action: 'update',
        field_name: 'product',
        new_value: productCode,
      }));

      await this.supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return ids.length;
  }

  /**
   * Get translation statistics by status
   */
  async getStats(productCode?: ProductCode): Promise<{
    pending: number;
    in_progress: number;
    reviewed: number;
    re_request: number;
    deployed: number;
    not_used: number;
    re_deploy_request: number;
    total: number;
  }> {
    // Build base query
    let query = this.supabase.from('translations').select('status');

    // Apply product filter
    if (productCode) {
      const { data: translationIds } = await this.supabase
        .from('translation_products')
        .select('translation_id')
        .eq('product_code', productCode);

      if (translationIds && translationIds.length > 0) {
        query = query.in('id', translationIds.map(t => t.translation_id));
      } else {
        // No translations for this product
        return {
          pending: 0,
          in_progress: 0,
          reviewed: 0,
          re_request: 0,
          deployed: 0,
          not_used: 0,
          re_deploy_request: 0,
          total: 0,
        };
      }
    }

    // Get all translations
    const { data: translations, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    // Count by status
    const counts = {
      pending: 0,
      in_progress: 0,
      reviewed: 0,
      re_request: 0,
      deployed: 0,
      not_used: 0,
      re_deploy_request: 0,
    };

    translations?.forEach((t) => {
      if (counts[t.status as keyof typeof counts] !== undefined) {
        counts[t.status as keyof typeof counts]++;
      }
    });

    return {
      ...counts,
      total: translations?.length || 0,
    };
  }

  /**
   * Update translation result (translated text)
   * Also logs the change to translation_logs if text changed
   */
  async updateTranslationResult(
    translationId: string,
    languageCode: LanguageCode,
    translatedText: string,
    reviewerId: string
  ): Promise<{ id: string; isNew: boolean }> {
    // Validate UUID
    if (!isValidUUID(translationId)) {
      throw new Error('Translation not found');
    }
    
    const trimmedText = translatedText.trim();

    // Check if result already exists
    const existingResult = await this.resultRepo.findByTranslationAndLanguage(
      translationId,
      languageCode
    );

    if (existingResult) {
      // Log change if text is different
      const previousText = existingResult.translated_text || '';
      if (previousText !== trimmedText) {
        // Log to translation_logs (non-blocking, fire-and-forget)
        this.supabase.from('translation_logs').insert({
          translation_result_id: existingResult.id,
          previous_text: previousText,
          new_text: trimmedText,
          changed_by: reviewerId,
        }).then(({ error }) => {
          if (error) {
            console.error('[TranslationLog] Failed to log change:', error);
          }
        });
      }

      // Update existing
      await this.resultRepo.update(
        translationId,
        languageCode,
        {
          translated_text: trimmedText,
          reviewer_id: reviewerId,
          reviewed_at: new Date().toISOString(),
          source_type: 'manual',
        }
      );

      return { id: existingResult.id, isNew: false };
    } else {
      // Create new
      const newResult = await this.resultRepo.create({
        translation_id: translationId,
        language_code: languageCode,
        translated_text: trimmedText,
        reviewer_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        source_type: 'manual',
      });

      return { id: newResult.id, isNew: true };
    }
  }

  /**
   * Update product codes for a translation
   */
  async updateProductCodes(
    translationId: string,
    productCodes: Array<string | { code: string; version?: string }>,
    version?: string
  ): Promise<void> {
    // Delete existing links
    await this.productRepo.deleteByTranslationId(translationId);

    // Create new links
    if ((productCodes || []).length === 0) return;

    const links = (productCodes || []).map(item => {
      const code = typeof item === 'string' ? item : item.code;
      const itemVersion = typeof item === 'object' && item.version ? item.version : version;
      
      return {
        translation_id: translationId,
        product_code: code as ProductCode,
        version: itemVersion || null,
        version_updated_at: itemVersion ? new Date().toISOString() : null,
      };
    });

    await this.productRepo.createMany(links);
  }

  /**
   * Update platform codes for a translation
   */
  async updatePlatformCodes(
    translationId: string,
    platformCodes: string[]
  ): Promise<void> {
    // Delete existing links
    await this.supabase
      .from('translation_platforms')
      .delete()
      .eq('translation_id', translationId);

    // Create new links
    if ((platformCodes || []).length === 0) return;

    const links = (platformCodes || []).map(platformCode => ({
      translation_id: translationId,
      platform_code: platformCode,
    }));

    await this.supabase.from('translation_platforms').insert(links);
  }

  /**
   * Update platform deploy status
   * Auto-updates translation status to 'deployed' if all platforms completed
   */
  async updatePlatformDeployStatus(
    translationId: string,
    platformCode: string,
    deployStatus: string
  ): Promise<{
    allCompleted: boolean;
    progress: number;
    completedCount: number;
    totalCount: number;
  }> {
    // Validate UUID
    if (!isValidUUID(translationId)) {
      throw new Error('Translation not found');
    }
    
    // Update platform deploy status
    const { error } = await this.supabase
      .from('translation_platforms')
      .update({ deploy_status: deployStatus })
      .eq('translation_id', translationId)
      .eq('platform_code', platformCode);

    if (error) {
      throw new Error(`Failed to update platform status: ${error.message}`);
    }

    // Get all platforms for this translation
    const { data: platforms } = await this.supabase
      .from('translation_platforms')
      .select('platform_code, deploy_status')
      .eq('translation_id', translationId);

    const totalCount = platforms?.length ?? 0;
    const completedCount = platforms?.filter(p => p.deploy_status === 'completed').length ?? 0;
    const allCompleted = totalCount > 0 && completedCount === totalCount;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Auto-update translation status to 'deployed' if all platforms completed
    if (allCompleted && totalCount > 0) {
      await this.translationRepo.update(translationId, { status: 'deployed' });
    }

    return {
      allCompleted,
      progress,
      completedCount,
      totalCount,
    };
  }

  /**
   * Get platform deployment status for a translation
   */
  async getPlatformDeployStatus(translationId: string): Promise<{
    platforms: Array<{ platform_code: string; deploy_status: string }>;
    progress: number;
    completedCount: number;
    totalCount: number;
    allCompleted: boolean;
  }> {
    // Validate UUID
    if (!isValidUUID(translationId)) {
      throw new Error('Translation not found');
    }
    
    const { data: platforms, error } = await this.supabase
      .from('translation_platforms')
      .select('platform_code, deploy_status')
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to fetch platforms: ${error.message}`);
    }

    const totalCount = platforms?.length ?? 0;
    const completedCount = platforms?.filter(p => p.deploy_status === 'completed').length ?? 0;
    const allCompleted = totalCount > 0 && completedCount === totalCount;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      platforms: platforms || [],
      progress,
      completedCount,
      totalCount,
      allCompleted,
    };
  }

  /**
   * Bulk revert translation results
   */
  async bulkRevertTranslationResults(
    revertItems: {
      translationResultId: string;
      revertText: string;
    }[],
    userId: string
  ): Promise<{
    successCount: number;
    errorCount: number;
    results: Array<{ id: string; reverted: boolean }>;
  }> {
    const results: Array<{ id: string; reverted: boolean }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of revertItems) {
      try {
        // Get current result
        const { data: currentResult } = await this.supabase
          .from('translation_results')
          .select('translated_text')
          .eq('id', item.translationResultId)
          .single();

        const curre[기밀마스킹]ext = currentResult?.translated_text || '';

        // Skip if same value
        if (curre[기밀마스킹]ext === item.revertText) {
          results.push({ id: item.translationResultId, reverted: false });
          continue;
        }

        // Create revert log
        await this.supabase.from('translation_logs').insert({
          translation_result_id: item.translationResultId,
          previous_text: curre[기밀마스킹]ext,
          new_text: item.revertText,
          changed_by: userId,
        });

        // Update translation result
        await this.supabase
          .from('translation_results')
          .update({
            translated_text: item.revertText,
            reviewer_id: userId,
            reviewed_at: new Date().toISOString(),
            source_type: 'manual',
          })
          .eq('id', item.translationResultId);

        results.push({ id: item.translationResultId, reverted: true });
        successCount++;
      } catch (err) {
        results.push({ id: item.translationResultId, reverted: false });
        errorCount++;
      }
    }

    return { successCount, errorCount, results };
  }

  /**
   * Bulk update product codes with versions
   */
  async bulkUpdateProductCodesWithVersions(
    translationIds: string[],
    productCodes: { code: ProductCode; version?: string }[],
    userInfo?: { userId: string; userName?: string | null; userEmail: string }
  ): Promise<number> {
    // Delete existing product associations
    const { error: deleteError } = await this.supabase
      .from('translation_products')
      .delete()
      .in('translation_id', translationIds);

    if (deleteError) {
      throw new Error(`Failed to delete existing products: ${deleteError.message}`);
    }

    // Insert new product associations
    if (productCodes.length > 0) {
      const productLinks = translationIds.flatMap((translationId) =>
        productCodes.map((item) => ({
          translation_id: translationId,
          product_code: item.code,
          version: item.version || null,
          version_updated_at: item.version ? new Date().toISOString() : null,
        }))
      );

      const { error } = await this.supabase
        .from('translation_products')
        .insert(productLinks);

      if (error) {
        throw new Error(`Failed to insert new products: ${error.message}`);
      }
    }

    // Create audit logs if user info provided
    if (userInfo) {
      const auditLogs = translationIds.flatMap(id =>
        productCodes.map(pc => ({
          translation_id: id,
          user_id: userInfo.userId,
          user_name: userInfo.userName,
          user_email: userInfo.userEmail,
          action: 'update',
          field_name: 'product',
          new_value: pc.code,
        }))
      );

      await this.supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return translationIds.length;
  }

  /**
   * Get bulk translation logs
   */
  async getBulkTranslationLogs(
    translationIds: string[],
    languageCode: string
  ): Promise<{
    logs: Array<{
      id: string;
      translationId: string;
      translationResultId: string;
      previousText: string;
      newText: string;
      createdAt: string;
      changedBy: string;
    }>;
    currentVersions: Array<{
      translationId: string;
      translationResultId: string;
      curre[기밀마스킹]ext: string;
      updatedAt: string | null;
      updatedBy: string;
    }>;
    totalCount: number;
  }> {
    // Get translation results
    const { data: translationResults } = await this.supabase
      .from('translation_results')
      .select('id, translation_id, translated_text, reviewer_id, reviewed_at')
      .in('translation_id', translationIds)
      .eq('language_code', languageCode);

    if (!translationResults?.length) {
      return { logs: [], currentVersions: [], totalCount: 0 };
    }

    const resultIds = translationResults.map(r => r.id);

    // Get all logs
    const { data: logs, error } = await this.supabase
      .from('translation_logs')
      .select('id, translation_result_id, previous_text, new_text, created_at, changed_by')
      .in('translation_result_id', resultIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }

    // Get user names
    const userIds = [
      ...new Set([
        ...(logs?.map(log => log.changed_by).filter(Boolean) || []),
        ...translationResults.map(r => r.reviewer_id).filter(Boolean)
      ])
    ];

    const { data: users } = await this.supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
    const resultMap = new Map(translationResults.map(r => [r.id, r]));

    // Format logs
    const formattedLogs = logs?.map((log) => {
      const result = resultMap.get(log.translation_result_id);
      return {
        id: log.id,
        translationId: result?.translation_id || '',
        translationResultId: log.translation_result_id,
        previousText: log.previous_text,
        newText: log.new_text,
        createdAt: log.created_at,
        changedBy: userMap.get(log.changed_by) || 'Unknown',
      };
    }) || [];

    // Current versions
    const currentVersions = translationResults
      .filter((result) => result.translated_text)
      .map((result) => ({
        translationId: result.translation_id,
        translationResultId: result.id,
        curre[기밀마스킹]ext: result.translated_text,
        updatedAt: result.reviewed_at || null,
        updatedBy: result.reviewer_id ? (userMap.get(result.reviewer_id) || 'Unknown') : '작성자',
      }));

    return {
      logs: formattedLogs,
      currentVersions,
      totalCount: formattedLogs.length + currentVersions.length,
    };
  }

  /**
   * Revert translation result to a previous version
   */
  async revertTranslationResult(
    logId: string,
    userId: string
  ): Promise<{
    translationResultId: string;
    previousText: string;
    revertedText: string;
  }> {
    // Validate UUID
    if (!isValidUUID(logId)) {
      throw new Error('Log not found');
    }
    
    // Get the log entry
    const { data: log, error: logError } = await this.supabase
      .from('translation_logs')
      .select('translation_result_id, previous_text')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      throw new Error('Log not found');
    }

    // Get current translation result
    const { data: currentResult } = await this.supabase
      .from('translation_results')
      .select('translated_text, language_code, translation_id')
      .eq('id', log.translation_result_id)
      .single();

    const curre[기밀마스킹]ext = currentResult?.translated_text || '';
    const revertText = log.previous_text;

    // Check if already at this version
    if (curre[기밀마스킹]ext === revertText) {
      throw new Error('ALREADY_AT_VERSION');
    }

    // Create revert log
    await this.supabase.from('translation_logs').insert({
      translation_result_id: log.translation_result_id,
      previous_text: curre[기밀마스킹]ext,
      new_text: revertText,
      changed_by: userId,
    });

    // Update translation result
    const { data: updated, error: updateError } = await this.supabase
      .from('translation_results')
      .update({
        translated_text: revertText,
        reviewer_id: userId,
        reviewed_at: new Date().toISOString(),
        source_type: 'manual',
      })
      .eq('id', log.translation_result_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to revert translation: ${updateError.message}`);
    }

    return {
      translationResultId: log.translation_result_id,
      previousText: curre[기밀마스킹]ext,
      revertedText: revertText,
    };
  }
}
