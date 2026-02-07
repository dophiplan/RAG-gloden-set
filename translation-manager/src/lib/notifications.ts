/**
 * 중앙 알림 관리
 * 향후 Toast UI로 교체 시 이 파일만 수정하면 됨
 */

export function showSuccess(message: string): void {
  alert(message);
}

export function showError(message: string): void {
  alert(message);
}

export function showConfirm(message: string): boolean {
  return confirm(message);
}
