/**
 * 중앙 알림 관리
 * react-hot-toast를 사용한 토스트 메시지
 */

import toast from 'react-hot-toast';

export function showSuccess(message: string): void {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
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

export function showConfirm(message: string): boolean {
  return confirm(message);
}
