/**
 * Entity Resolver
 * 
 * entity_type → 테이블/필드 매핑
 */

export interface EntityConfig {
  table: string;
  idField: string;
  valueField: string;
  auditTable: string;
}

export function resolveEntityConfig(entityType: string): EntityConfig {
  switch (entityType) {
    case 'translation':
      return {
        table: 'translations',
        idField: 'translation_id',
        valueField: 'source_text',
        auditTable: 'translation_audit_logs',
      };
    case 'glossary':
      return {
        table: 'glossary',
        idField: 'glossary_term_id',
        valueField: 'translation',
        auditTable: 'glossary_audit_logs',
      };
    default:
      throw new Error(`지원하지 않는 entity_type입니다: ${entityType}`);
  }
}
