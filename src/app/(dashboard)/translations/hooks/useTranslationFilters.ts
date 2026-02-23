import { useState } from 'react';
import { TranslationStatus, ProductCode, LanguageCode, ScopeType } from '@/types';

export function useTranslationFilters() {
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | ''>('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [requestIdFilter, setRequestIdFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeType>('');
  const [versionFilter, setVersionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Languages to display in table columns (null = show all available for product)
  // Default to show English, Japanese, Chinese only
  const [selectedLanguageColumns, setSelectedLanguageColumns] = useState<LanguageCode[] | null>(['en', 'ja', 'zh-CN']);

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('');
    setLanguageFilter('');
    setSearchTerm('');
    setSelectedProduct(null);
    setRequestIdFilter(null);
    setScopeFilter('');
    setVersionFilter('');
    setCreatedAfter('');
    setCreatedBefore('');
    setPage(1);
  };

  // Quick filter functions
  const setQuickFilter = (filterType: 'today' | 'this_week' | 'this_month' | 'frequently_used') => {
    const now = new Date();
    if (filterType === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setCreatedAfter(todayStart.toISOString().split('T')[0]);
      setCreatedBefore('');
    } else if (filterType === 'this_week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setCreatedAfter(weekAgo.toISOString().split('T')[0]);
      setCreatedBefore('');
    } else if (filterType === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setCreatedAfter(monthStart.toISOString().split('T')[0]);
      setCreatedBefore('');
    } else if (filterType === 'frequently_used') {
      // For translations, this might not apply, but keep for consistency
      setCreatedAfter('');
      setCreatedBefore('');
    }
  };

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
    showAdvancedFilters,
    setShowAdvancedFilters,
    toggleAdvancedFilters: () => setShowAdvancedFilters(prev => !prev),
    createdAfter,
    setCreatedAfter,
    createdBefore,
    setCreatedBefore,
    setQuickFilter,
    applyQuickFilter: setQuickFilter, // Alias for backward compatibility
    clearAllFilters,
  };
}
