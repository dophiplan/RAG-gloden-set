import { MAX_FILE_SIZE } from '@/lib/constants';

/**
 * File Size Validator
 * 
 * Validates file sizes against maximum allowed size.
 * Pure function - no side effects, easily testable.
 */

export interface FileSizeValidationResult {
  valid: boolean;
  size: number;
  maxSize: number;
  sizeInMB: number;
  sizeExceeded: boolean;
  error?: string;
}

/**
 * Convert bytes to megabytes
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Size in MB as string
 * 
 * @example
 * bytesToMB(4718592) // '4.50'
 * bytesToMB(1024 * 1024) // '1.00'
 */
export function bytesToMB(bytes: number, decimals: number = 2): string {
  return (bytes / 1024 / 1024).toFixed(decimals);
}

/**
 * Convert bytes to human readable format
 * 
 * @param bytes - File size in bytes
 * @returns Human readable string (e.g., "4.50 MB", "512 KB")
 * 
 * @example
 * formatFileSize(4718592) // '4.50 MB'
 * formatFileSize(512000) // '500.00 KB'
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if file size is within allowed limit
 * 
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes (default: MAX_FILE_SIZE from constants)
 * @returns boolean indicating if file size is valid
 * 
 * @example
 * isValidFileSize(1024 * 1024) // true (1MB < 4.5MB)
 * isValidFileSize(5 * 1024 * 1024) // false (5MB > 4.5MB)
 */
export function isValidFileSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE
): boolean {
  return size <= maxSize;
}

/**
 * Validate file size and return detailed result
 * 
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes (default: MAX_FILE_SIZE from constants)
 * @returns FileSizeValidationResult with validation details
 * 
 * @example
 * validateFileSize(1024 * 1024)
 * // { valid: true, size: 1048576, maxSize: 4718592, sizeInMB: 1, sizeExceeded: false }
 * 
 * validateFileSize(5 * 1024 * 1024)
 * // { valid: false, size: 5242880, maxSize: 4718592, sizeInMB: 5, sizeExceeded: true, error: '...' }
 */
export function validateFileSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE
): FileSizeValidationResult {
  const sizeInMB = parseFloat(bytesToMB(size));
  const maxSizeInMB = parseFloat(bytesToMB(maxSize));
  const sizeExceeded = size > maxSize;

  return {
    valid: !sizeExceeded,
    size,
    maxSize,
    sizeInMB,
    sizeExceeded,
    error: sizeExceeded ? getOversizedFileError(sizeInMB, maxSizeInMB) : undefined,
  };
}

/**
 * Get error message for oversized file
 * 
 * @param sizeInMB - File size in MB
 * @param maxSizeInMB - Maximum allowed size in MB (default: 4.5)
 * @returns Localized error message
 * 
 * @example
 * getOversizedFileError(5.5, 4.5) // '파일 크기는 4.50MB를 초과할 수 없습니다. (현재: 5.50MB)'
 */
export function getOversizedFileError(
  sizeInMB: number,
  maxSizeInMB: number = 4.5
): string {
  return `파일 크기는 ${maxSizeInMB.toFixed(2)}MB를 초과할 수 없습니다. (현재: ${sizeInMB.toFixed(2)}MB)`;
}

/**
 * Get maximum file size in bytes
 * 
 * @returns Maximum file size in bytes
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}

/**
 * Get maximum file size in MB
 * 
 * @returns Maximum file size in MB
 */
export function getMaxFileSizeInMB(): number {
  return MAX_FILE_SIZE / 1024 / 1024;
}
