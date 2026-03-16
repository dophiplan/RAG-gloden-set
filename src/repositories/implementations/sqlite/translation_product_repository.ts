/**
 * SQLite Translation Product Repository Implementation
 * 
 * 번역-제품 간 다대다 관계 관리를 위한 SQLite 기반 Repository 구현체
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteTranslationProductRepository(db);
 * await repo.updateForTranslation('trans-1', ['RC', 'RV']);
 * ```
 */

import type {
  ITranslationProductRepository,
  TranslationProductCreateData,
} from '@/repositories/interfaces/translation_product_repository';
import type { TranslationProduct, ProductCode } from '@/types';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { generateUUID } from '@/lib/validation/uuid';

export class SqliteTranslationProductRepository implements ITranslationProductRepository {
  constructor(private db: SqliteDatabase) {}

  /**
   * 다중 번역-제품 연결 생성
   */
  async createMany(links: TranslationProductCreateData[]): Promise<TranslationProduct[]> {
    if ((links || []).length === 0) return [];

    const created: TranslationProduct[] = [];
    const now = new Date().toISOString();

    // 트랜잭션 내에서 일괄 생성
    this.db.transaction((trx) => {
      for (const link of links) {
        const id = generateUUID();

        trx.run(
          `
          INSERT INTO translation_products (
            id, translation_id, product_code, version, version_updated_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            link.translation_id,
            link.product_code,
            link.version || null,
            link.version_updated_at || null,
            now,
          ]
        );

        // 생성된 레코드 조회
        const inserted = trx.get<TranslationProduct>(
          'SELECT * FROM translation_products WHERE id = ?',
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
   * 번역 ID로 연결 목록 조회
   */
  async findByTranslationId(translationId: string): Promise<TranslationProduct[]> {
    const results = this.db.all<TranslationProduct>(
      `
      SELECT * FROM translation_products 
      WHERE translation_id = ? 
      ORDER BY product_code
    `,
      [translationId]
    );

    return results || [];
  }

  /**
   * 번역 ID로 연결 삭제
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    this.db.run('DELETE FROM translation_products WHERE translation_id = ?', [translationId]);
  }

  /**
   * 번역의 제품 연결 업데이트 (삭제 후 생성)
   */
  async updateForTranslation(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<TranslationProduct[]> {
    // 트랜잭션 내에서 삭제 후 생성
    const created: TranslationProduct[] = [];
    const now = new Date().toISOString();

    this.db.transaction((trx) => {
      // 기존 연결 삭제
      trx.run('DELETE FROM translation_products WHERE translation_id = ?', [translationId]);

      // 새 연결 생성
      if ((productCodes || []).length > 0) {
        for (const code of productCodes) {
          const id = generateUUID();

          trx.run(
            `
            INSERT INTO translation_products (
              id, translation_id, product_code, created_at
            ) VALUES (?, ?, ?, ?)
          `,
            [id, translationId, code, now]
          );

          const inserted = trx.get<TranslationProduct>(
            'SELECT * FROM translation_products WHERE id = ?',
            [id]
          );

          if (inserted) {
            created.push(inserted);
          }
        }
      }
    });

    return created;
  }
}
