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

export function showSuccess(message: string, options?: ToastOptions): void {
  if (options?.action) {
    toast.success(
      (t) => (
        <div className="flex items-center gap-3">
          <span>{message}</span>
          <button
            onClick={() => {
              options.action!.onClick();
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

export function showError(message: string): void {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
  });
}

export function showInfo(message: string): void {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
}

export function showWarning(message: string): void {
  toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
    style: {
      background: '#FEF3C7',
      color: '#92400E',
    },
  });
}

export function showConfirm(message: string): boolean {
  return confirm(message);
}
