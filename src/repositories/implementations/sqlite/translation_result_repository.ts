/**
 * SQLite Translation Result Repository Implementation
 * 
 * 번역 결과(다국어 번역) 관리를 위한 SQLite 기반 Repository 구현체
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteTranslationResultRepository(db);
 * const results = await repo.findByTranslationId('trans-1');
 * await repo.upsert({ translation_id: 'id', language_code: 'ko', translated_text: '안녕' });
 * ```
 */

import type {
  ITranslationResultRepository,
  TranslationResultCreateData,
  TranslationResultUpdateData,
} from '@/repositories/interfaces/translation_result_repository';
import type { TranslationResult, LanguageCode } from '@/types';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { generateUUID } from '@/lib/validation/uuid';

export class SqliteTranslationResultRepository implements ITranslationResultRepository {
  constructor(private db: SqliteDatabase) {}

  /**
   * 번역 ID로 번역 결과 목록 조회
   */
  async findByTranslationId(translationId: string): Promise<TranslationResult[]> {
    const results = this.db.all<TranslationResult>(
      `
      SELECT * FROM translation_results 
      WHERE translation_id = ? 
      ORDER BY language_code
    `,
      [translationId]
    );

    return results || [];
  }

  /**
   * 단일 번역 결과 조회
   */
  async findOne(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    const result = this.db.get<TranslationResult>(
      `
      SELECT * FROM translation_results 
      WHERE translation_id = ? AND language_code = ?
    `,
      [translationId, languageCode]
    );

    return result || null;
  }

  /**
   * 번역 ID와 언어 코드로 번역 결과 조회 (findOne 별칭)
   */
  async findByTranslationAndLanguage(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    return this.findOne(translationId, languageCode);
  }

  /**
   * 번역 결과 생성
   */
  async create(result: TranslationResultCreateData): Promise<TranslationResult> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const {
      translation_id,
      language_code,
      translated_text,
      reviewer_id,
      reviewed_at,
      source_type,
      glossary_term_id,
    } = result;

    this.db.run(
      `
      INSERT INTO translation_results (
        id, translation_id, language_code, translated_text,
        reviewer_id, reviewed_at, source_type, glossary_term_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        translation_id,
        language_code,
        translated_text,
        reviewer_id || null,
        reviewed_at || null,
        source_type || null,
        glossary_term_id || null,
        now,
        now,
      ]
    );

    const created = await this.findOne(translation_id, language_code);
    if (!created) {
      throw new Error('Failed to fetch created translation result');
    }

    return created;
  }

  /**
   * 다중 번역 결과 생성
   */
  async createMany(results: TranslationResultCreateData[]): Promise<TranslationResult[]> {
    if (results.length === 0) return [];

    const created: TranslationResult[] = [];

    // 트랜잭션 내에서 일괄 생성
    this.db.transaction((trx) => {
      const now = new Date().toISOString();

      for (const result of results) {
        const id = generateUUID();
        const {
          translation_id,
          language_code,
          translated_text,
          reviewer_id,
          reviewed_at,
          source_type,
          glossary_term_id,
        } = result;

        trx.run(
          `
          INSERT INTO translation_results (
            id, translation_id, language_code, translated_text,
            reviewer_id, reviewed_at, source_type, glossary_term_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            translation_id,
            language_code,
            translated_text,
            reviewer_id || null,
            reviewed_at || null,
            source_type || null,
            glossary_term_id || null,
            now,
            now,
          ]
        );

        // 생성된 결과 조회
        const inserted = trx.get<TranslationResult>(
          'SELECT * FROM translation_results WHERE id = ?',
          [id]
        );

        if (inserted) {
          created.push(inserted);
        }
      }
    });

    return created;
  }

  /**
   * 번역 결과 업데이트
   */
  async update(
    translationId: string,
    languageCode: LanguageCode,
    updates: TranslationResultUpdateData
  ): Promise<TranslationResult> {
    const now = new Date().toISOString();

    // 업데이트할 필드 동적 구성
    const updateFields: string[] = [];
    const params: unknown[] = [];

    const allowedFields = [
      'translated_text',
      'reviewer_id',
      'reviewed_at',
      'source_type',
      'glossary_term_id',
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        updateFields.push(`${field} = ?`);
        params.push((updates as Record<string, unknown>)[field]);
      }
    }

    // updated_at 자동 업데이트
    updateFields.push('updated_at = ?');
    params.push(now);

    // WHERE 조건 파라미터 추가
    params.push(translationId, languageCode);

    const result = this.db.run(
      `
      UPDATE translation_results 
      SET ${updateFields.join(', ')} 
      WHERE translation_id = ? AND language_code = ?
    `,
      params
    );

    if (result.changes === 0) {
      throw new Error(
        `Translation result not found: translation_id=${translationId}, language_code=${languageCode}`
      );
    }

    const updated = await this.findOne(translationId, languageCode);
    if (!updated) {
      throw new Error('Failed to fetch updated translation result');
    }

    return updated;
  }

  /**
   * 번역 ID로 번역 결과 삭제
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    this.db.run('DELETE FROM translation_results WHERE translation_id = ?', [translationId]);
  }

  /**
   * Upsert (있으면 업데이트, 없으면 생성)
   * 
   * SQLite에서는 INSERT OR REPLACE 구문을 사용합니다.
   */
  async upsert(result: TranslationResultCreateData): Promise<TranslationResult> {
    const now = new Date().toISOString();

    // 기존 레코드 확인
    const existing = await this.findOne(result.translation_id, result.language_code);

    if (existing) {
      // 업데이트
      const updateFields: string[] = [];
      const params: unknown[] = [];

      if (result.translated_text !== undefined) {
        updateFields.push('translated_text = ?');
        params.push(result.translated_text);
      }
      if (result.reviewer_id !== undefined) {
        updateFields.push('reviewer_id = ?');
        params.push(result.reviewer_id);
      }
      if (result.reviewed_at !== undefined) {
        updateFields.push('reviewed_at = ?');
        params.push(result.reviewed_at);
      }
      if (result.source_type !== undefined) {
        updateFields.push('source_type = ?');
        params.push(result.source_type);
      }
      if (result.glossary_term_id !== undefined) {
        updateFields.push('glossary_term_id = ?');
        params.push(result.glossary_term_id);
      }

      updateFields.push('updated_at = ?');
      params.push(now);

      // WHERE 조건
      params.push(result.translation_id, result.language_code);

      this.db.run(
        `
        UPDATE translation_results 
        SET ${updateFields.join(', ')} 
        WHERE translation_id = ? AND language_code = ?
      `,
        params
      );

      const updated = await this.findOne(result.translation_id, result.language_code);
      if (!updated) {
        throw new Error('Failed to fetch upserted translation result');
      }

      return updated;
    } else {
      // 생성
      return this.create(result);
    }
  }
}
