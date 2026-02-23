/**
 * 중앙 알림 관리
 * react-hot-toast를 사용한 토스트 메시지
 */

import React from 'react';
import toast from 'react-hot-toast';

interface ToastOptions {
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * Show a success toast notification
 * @param message - The message to display
 * @param options - Optional configuration including action button and duration
 */
export function showSuccess(message: string, options?: ToastOptions): void {
  if (options?.action) {
    toast.success(
      (t) => (
        <div className="flex items-center gap-3">
          <span>{message}</span>
          <button
            onClick={() => {
              try {
                options.action!.onClick();
              } catch (error) {
                console.error('Action button click failed:', error);
              }
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-[#4F46E5] rounded hover:bg-[#4a8542] transition-colors"
          >
            {options.action!.label}
          </button>
        </div>
      ),
      {
        duration: options.duration || 3000,
        position: 'top-right',
      }
    );
  } else {
    toast.success(message, {
      duration: options?.duration || 3000,
      position: 'top-right',
    });
  }
}

/**
 * Show an error toast notification
 * @param message - The error message to display
 */
export function showError(message: string): void {
  // Ensure message is a string and not empty
  const safeMessage = message?.trim() || '오류가 발생했습니다';
  
  toast.error(safeMessage, {
    duration: 4000,
    position: 'top-right',
  });
}

/**
 * Show an info toast notification
 * @param message - The info message to display
 */
export function showInfo(message: string): void {
  const safeMessage = message?.trim() || '정보';
  
  toast(safeMessage, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
}

/**
 * Show a warning toast notification
 * @param message - The warning message to display
 */
export function showWarning(message: string): void {
  const safeMessage = message?.trim() || '주의';
  
  toast(safeMessage, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
    style: {
      background: '#FEF3C7',
      color: '#92400E',
    },
  });
}

/**
 * Show a confirmation dialog
 * Note: This uses the native browser confirm dialog. For a custom UI,
 * consider using a modal component instead.
 * @param message - The confirmation message to display
 * @returns boolean indicating user confirmation
 */
export function showConfirm(message: string): boolean {
  const safeMessage = message?.trim() || '계속하시겠습니까?';
  
  if (typeof window === 'undefined') {
    console.warn('showConfirm called in non-browser environment');
    return false;
  }
  
  return confirm(safeMessage);
}

/**
 * Dismiss all toast notifications
 */
export function dismissAllToasts(): void {
  toast.dismiss();
}

/**
 * Dismiss a specific toast notification
 * @param toastId - The ID of the toast to dismiss
 */
export function dismissToast(toastId: string): void {
  toast.dismiss(toastId);
}
