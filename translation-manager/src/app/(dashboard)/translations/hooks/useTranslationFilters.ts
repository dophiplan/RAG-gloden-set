import { useState } from 'react';
import { TranslationStatus, ProductCode } from '@/types';

export function useTranslationFilters() {
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  return {
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    selectedProduct,
    setSelectedProduct,
    page,
    setPage,
    totalPages,
    setTotalPages,
  };
}
