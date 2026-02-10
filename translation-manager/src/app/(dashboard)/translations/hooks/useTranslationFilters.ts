import { useState } from 'react';
import { TranslationStatus, ProductCode, LanguageCode } from '@/types';

export function useTranslationFilters() {
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | ''>('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [requestIdFilter, setRequestIdFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'SaaS' | 'Solution' | ''>('');
  const [versionFilter, setVersionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Languages to display in table columns (null = show all available for product)
  // Default to show all languages
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
    requestIdFilter,
    setRequestIdFilter,
    scopeFilter,
    setScopeFilter,
    versionFilter,
    setVersionFilter,
    page,
    setPage,
    totalPages,
    setTotalPages,
    selectedLanguageColumns,
    setSelectedLanguageColumns,
  };
}
