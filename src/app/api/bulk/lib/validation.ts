/**
 * Validation Utilities
 * 
 * 공통 검증 함수들
 */

export function validateIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string');
}

export function validateItems(items: unknown): items is Array<Record<string, unknown>> {
  return Array.isArray(items) && items.length > 0;
}

export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null) {
      return `${field}는 필수입니다.`;
    }
  }
  return null;
}

export function validateEntityType(entityType: unknown): entityType is 'translation' | 'glossary' {
  return entityType === 'translation' || entityType === 'glossary';
}

export function validateOperation(operation: unknown): operation is 'single' | 'batch' | 'date-based' {
  return operation === 'single' || operation === 'batch' || operation === 'date-based';
}
