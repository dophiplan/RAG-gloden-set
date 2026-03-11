'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

/**
 * @deprecated This page is deprecated. Use /translations?product=xxx instead.
 * This component redirects to the unified translations page with product query param.
 */
export default function TranslationsProductPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const product = params.product as string;
    const currentSearchParams = new URLSearchParams(searchParams.toString());
    
    // Preserve existing query params and add product
    currentSearchParams.set('product', product);
    
    // Redirect to unified page
    router.replace(`/translations?${currentSearchParams.toString()}`);
  }, [params.product, router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Redirecting...</div>
    </div>
  );
}
