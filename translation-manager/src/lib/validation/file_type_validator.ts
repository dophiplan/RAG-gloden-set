/**
 * File Type Validator
 * 
 * Validates file MIME types against supported formats.
 * Pure function - no side effects, easily testable.
 */

// Supported file types
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
] as const;

export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  ...SUPPORTED_IMAGE_TYPES,
] as const;

export type SupportedFileType = typeof SUPPORTED_FILE_TYPES[number];
export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number];

export interface FileTypeValidationResult {
  valid: boolean;
  fileType: string;
  isImage: boolean;
  isPDF: boolean;
  error?: string;
}

/**
 * Check if file type is supported
 * 
 * @param fileType - MIME type of the file
 * @returns boolean indicating if file type is supported
 * 
 * @example
 * isSupportedFileType('application/pdf') // true
 * isSupportedFileType('text/plain') // false
 */
export function isSupportedFileType(fileType: string): boolean {
  return SUPPORTED_FILE_TYPES.includes(fileType as SupportedFileType);
}

/**
 * Check if file type is an image
 * 
 * @param fileType - MIME type of the file
 * @returns boolean indicating if file is an image
 */
export function isImageFile(fileType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(fileType as SupportedImageType);
}

/**
 * Check if file type is PDF
 * 
 * @param fileType - MIME type of the file
 * @returns boolean indicating if file is PDF
 */
export function isPDFFile(fileType: string): boolean {
  return fileType === 'application/pdf';
}

/**
 * Validate file type and return detailed result
 * 
 * @param fileType - MIME type of the file
 * @returns FileTypeValidationResult with validation details
 * 
 * @example
 * validateFileType('application/pdf')
 * // { valid: true, fileType: 'application/pdf', isImage: false, isPDF: true }
 * 
 * validateFileType('text/plain')
 * // { valid: false, fileType: 'text/plain', isImage: false, isPDF: false, error: '...' }
 */
export function validateFileType(fileType: string): FileTypeValidationResult {
  const isPDF = isPDFFile(fileType);
  const isImage = isImageFile(fileType);
  const valid = isPDF || isImage;

  return {
    valid,
    fileType,
    isImage,
    isPDF,
    error: valid ? undefined : getUnsupportedFileTypeError(),
  };
}

/**
 * Get error message for unsupported file type
 * 
 * @returns Localized error message
 */
export function getUnsupportedFileTypeError(): string {
  return '지원하지 않는 파일 형식입니다. (PDF, PNG, JPG, GIF, WEBP만 가능)';
}

/**
 * Get list of supported file extensions for display
 * 
 * @returns Array of file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
}

/**
 * Get supported file types for a specific category
 * 
 * @param category - 'all', 'images', or 'pdf'
 * @returns Array of supported MIME types
 */
export function getSupportedTypes(category: 'all' | 'images' | 'pdf' = 'all'): string[] {
  switch (category) {
    case 'images':
      return [...SUPPORTED_IMAGE_TYPES];
    case 'pdf':
      return ['application/pdf'];
    case 'all':
    default:
      return [...SUPPORTED_FILE_TYPES];
  }
}
