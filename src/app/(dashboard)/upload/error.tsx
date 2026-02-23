'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Upload Page Error]:', error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-text-main">
            문제가 발생했습니다
          </h2>
          <p className="text-sm text-text-secondary">
            업로드 페이지를 불러오는 중 오류가 발생했습니다.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800 font-mono break-words">
            {error.message || '알 수 없는 오류'}
          </p>
          {error.digest && (
            <p className="text-xs text-red-600 mt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={reset}
            className="w-full"
          >
            다시 시도
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="secondary"
            className="w-full"
          >
            대시보드로 돌아가기
          </Button>
        </div>

        <p className="text-xs text-text-muted text-center">
          문제가 계속되면 시스템 관리자에게 문의하세요.
        </p>
      </Card>
    </div>
  );
}
