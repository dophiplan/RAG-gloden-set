import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationAuditRepository } from '@/repositories';
import { AuditAction } from '@/types';

export interface AuditLogData {
  translationId?: string;
  translationResultId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Service for logging translation changes
 * All operations are non-blocking to not impact main operations
 */
export class TranslationAuditLogger {
  private auditRepo: TranslationAuditRepository;

  constructor(supabase: SupabaseClient) {
    this.auditRepo = new TranslationAuditRepository(supabase);
  }

  /**
   * Log a translation creation (non-blocking)
   */
  async logCreation(data: {
    translationId: string;
    userId: string;
    userName?: string | null;
    userEmail: string;
    sourceText: string;
  }): Promise<void> {
    await this.auditRepo.create({
      translation_id: data.translationId,
      user_id: data.userId,
      user_name: data.userName || null,
      user_email: data.userEmail,
      action: 'create',
      new_value: data.sourceText,
    });
  }

  /**
   * Log a translation update (non-blocking)
   */
  async logUpdate(data: {
    translationId: string;
    userId: string;
    userName?: string | null;
    userEmail: string;
    fieldName: string;
    oldValue?: string;
    newValue?: string;
  }): Promise<void> {
    await this.auditRepo.create({
      translation_id: data.translationId,
      user_id: data.userId,
      user_name: data.userName || null,
      user_email: data.userEmail,
      action: 'update',
      field_name: data.fieldName,
      old_value: data.oldValue || null,
      new_value: data.newValue || null,
    });
  }

  /**
   * Log a translation deletion (non-blocking)
   */
  async logDeletion(data: {
    translationId: string;
    userId: string;
    userName?: string | null;
    userEmail: string;
    sourceText: string;
  }): Promise<void> {
    await this.auditRepo.create({
      translation_id: data.translationId,
      user_id: data.userId,
      user_name: data.userName || null,
      user_email: data.userEmail,
      action: 'delete',
      old_value: data.sourceText,
    });
  }

  /**
   * Log AI translation action (non-blocking)
   */
  async logAiTranslation(data: {
    translationId: string;
    userId: string;
    userName?: string | null;
    userEmail: string;
    languageCode: string;
    translatedText: string;
  }): Promise<void> {
    await this.auditRepo.create({
      translation_id: data.translationId,
      user_id: data.userId,
      user_name: data.userName || null,
      user_email: data.userEmail,
      action: 'ai_translate',
      field_name: data.languageCode,
      new_value: data.translatedText,
    });
  }

  /**
   * Log bulk creation (non-blocking)
   */
  async logBulkCreation(
    translations: Array<{
      id: string;
      source_text: string;
    }>,
    user: {
      id: string;
      name?: string | null;
      email: string;
    }
  ): Promise<void> {
    const auditLogs = translations.map(t => ({
      translation_id: t.id,
      user_id: user.id,
      user_name: user.name || null,
      user_email: user.email,
      action: 'create' as const,
      new_value: t.source_text,
    }));

    // Create all audit logs in parallel (non-blocking)
    await Promise.allSettled(
      auditLogs.map(log => this.auditRepo.create(log))
    );
  }

  /**
   * Get audit history for a translation
   */
  async getHistory(translationId: string) {
    return this.auditRepo.getByTranslationId(translationId);
  }

  /**
   * Get latest audit logs for multiple translations
   */
  async getLatestLogs(translationIds: string[]) {
    return this.auditRepo.getLatestByTranslationIds(translationIds);
  }
}
