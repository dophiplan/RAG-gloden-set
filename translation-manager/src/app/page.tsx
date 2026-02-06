'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// TEMPORARY: Skip auth check for demo/testing
// TODO: Re-enable authentication after email verification is configured

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // 바로 번역 관리 페이지로 이동
    router.push('/translations');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
