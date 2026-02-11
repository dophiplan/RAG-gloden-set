/**
 * File Upload Validation Utilities
 *
 * Provides security and validation for file uploads
 */

// Maximum file size: 4.5MB (Vercel serverless function limit)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes

// Allowed MIME types for Excel/CSV files
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/csv',
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Validate uploaded file for Excel/CSV imports
 */
export function validateUploadedFile(file: File | null): FileValidationResult {
  // Check if file exists
  if (!file) {
    return {
      valid: false,
      error: '파일을 업로드해주세요.',
      errorCode: 'FILE_REQUIRED',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
    const actualSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 업로드 가능합니다. (현재: ${actualSizeMB}MB)`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    // Some browsers don't set MIME type correctly, so also check extension
    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        valid: false,
        error: `지원하지 않는 파일 형식입니다. Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다. (현재: ${file.type || '알 수 없음'})`,
        errorCode: 'INVALID_FILE_TYPE',
      };
    }
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 확장자입니다. .xlsx, .xls, .csv 파일만 업로드 가능합니다. (현재: ${extension})`,
      errorCode: 'INVALID_FILE_EXTENSION',
    };
  }

  return { valid: true };
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Validate file content size after parsing
 */
export function validateFileContentSize(rowCount: number, maxRows: number = 500): FileValidationResult {
  if (rowCount > maxRows) {
    return {
      valid: false,
      error: `파일에 너무 많은 데이터가 있습니다. 최대 ${maxRows}개 행까지 처리 가능합니다. (현재: ${rowCount}개)`,
      errorCode: 'TOO_MANY_ROWS',
    };
  }

  if (rowCount === 0) {
    return {
      valid: false,
      error: '파일에 데이터가 없습니다.',
      errorCode: 'EMPTY_FILE',
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent directory traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path components
  const basename = filename.replace(/^.*[\\\/]/, '');

  // Remove potentially dangerous characters
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return sanitized;
}

/**
 * Constants for export
 */
export const FILE_UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB: MAX_FILE_SIZE / (1024 * 1024),
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_ROWS_DEFAULT: 500,
};
