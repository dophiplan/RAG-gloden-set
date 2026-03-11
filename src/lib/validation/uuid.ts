/**
 * UUID validation utilities
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Validate UUID and throw error if invalid
 */
export function validateUUID(id: string, fieldName = 'id'): void {
  if (!isValidUUID(id)) {
    throw new ValidationError(`INVALID_${fieldName.toUpperCase()}`, `Invalid ${fieldName} format`);
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
