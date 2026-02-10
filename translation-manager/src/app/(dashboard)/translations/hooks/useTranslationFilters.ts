import { useState } from 'react';
import { TranslationStatus, ProductCode, LanguageCode } from '@/types';

export function useTranslationFilters() {
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | ''>('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Languages to display in table columns (null = show all available for product)
  const [selectedLanguageColumns, setSelectedLanguageColumns] = useState<LanguageCode[] | null>(null);

  return {
    statusFilter,
    setStatusFilter,
    languageFilter,
    setLanguageFilter,
    searchTerm,
    setSearchTerm,
    selectedProduct,
    setSelectedProduct,
    page,
    setPage,
    totalPages,
    setTotalPages,
    selectedLanguageColumns,
    setSelectedLanguageColumns,
  };
}
