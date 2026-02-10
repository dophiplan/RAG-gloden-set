'use client';

import { useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@/types';
import DuplicateConflictModal from './DuplicateConflictModal';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: 'glossary' | 'translation';
  action?: 'import' | 'skip' | 'merge' | 'overwrite';
}

interface Props {
  glossaryEntries: PreviewEntry[];
  translationEntries: PreviewEntry[];
  onUpdateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
}

export default function MigrationPreviewTable({
  glossaryEntries,
  translationEntries,
  onUpdateEntry,
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<PreviewEntry | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const allEntries = [...glossaryEntries, ...translationEntries];
  const totalPages = Math.ceil(allEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGlossary = glossaryEntries.slice(
    Math.max(0, startIndex - translationEntries.length),
    Math.max(0, endIndex - translationEntries.length)
  );
  const paginatedTranslations = translationEntries.slice(startIndex, endIndex);

  const moveToGlossary = (id: string) => {
    onUpdateEntry(id, { category: 'glossary' });
  };

  const moveToTranslation = (id: string) => {
    onUpdateEntry(id, { category: 'translation' });
  };

  const handleDuplicateClick = (entry: PreviewEntry) => {
    setSelectedEntry(entry);
    setShowDuplicateModal(true);
  };

  const handleDuplicateAction = (action: 'import' | 'skip' | 'merge' | 'overwrite') => {
    if (selectedEntry) {
      onUpdateEntry(selectedEntry.id, { action });
      setShowDuplicateModal(false);
      setSelectedEntry(null);
    }
  };

  const getDuplicateStatusBadge = (status: 'exact' | 'similar' | 'new') => {
    const badges = {
      exact: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: '동일 항목 있음',
        icon: '🟡',
      },
      similar: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: '유사 항목 있음',
        icon: '🔵',
      },
      new: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: '새 항목',
        icon: '🟢',
      },
    };

    const badge = badges[status];
    return (
      <span
        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}
      >
        <span className="mr-1">{badge.icon}</span>
        {badge.label}
      </span>
    );
  };

  const getActionBadge = (action?: string) => {
    if (!action || action === 'import') return null;

    const badges: Record<string, { bg: string; text: string; label: string }> = {
      skip: { bg: 'bg-gray-100', text: 'text-gray-800', label: '건너뛰기' },
      merge: { bg: 'bg-blue-100', text: 'text-blue-800', label: '병합' },
      overwrite: { bg: 'bg-orange-100', text: 'text-orange-800', label: '덮어쓰기' },
    };

    const badge = badges[action];
    if (!badge) return null;

    return (
      <span
        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  };

  const EntryCard = ({ entry, type }: { entry: PreviewEntry; type: 'glossary' | 'translation' }) => (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-medium text-gray-900 mb-1">{entry.source_text}</p>
          {entry.context && (
            <p className="text-sm text-gray-600 mb-2">{entry.context}</p>
          )}
        </div>
        <button
          onClick={() => {
            if (type === 'glossary') {
              moveToTranslation(entry.id);
            } else {
              moveToGlossary(entry.id);
            }
          }}
          className="ml-2 p-1 text-gray-400 hover:text-[#7BC96F] transition-colors"
          title={type === 'glossary' ? '번역으로 이동' : '용어집으로 이동'}
        >
          {type === 'glossary' ? '→' : '←'}
        </button>
      </div>

      {/* Translations */}
      <div className="flex flex-wrap gap-2 mb-2">
        {Object.entries(entry.translations).map(([langCode, text]) => {
          const languageName = SUPPORTED_LANGUAGES[langCode as keyof typeof SUPPORTED_LANGUAGES];
          if (!languageName) return null;
          return (
            <span
              key={langCode}
              className="inline-flex items-center px-2 py-1 bg-[#E8F5E9] text-[#5FA654] text-xs rounded"
              title={text}
            >
              {langCode.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {getDuplicateStatusBadge(entry.duplicate_status.status)}
        {getActionBadge(entry.action)}

        {/* Duplicate Action Button */}
        {entry.duplicate_status.status !== 'new' && (
          <button
            onClick={() => handleDuplicateClick(entry)}
            className="text-xs text-blue-600 hover:underline"
          >
            처리 방법 선택
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Glossary Column */}
        <div>
          <div className="bg-gradient-to-r from-[#7BC96F] to-[#66BB6A] text-white px-4 py-3 rounded-t-lg">
            <h3 className="font-semibold">용어집 ({glossaryEntries.length})</h3>
          </div>
          <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 bg-gray-50 min-h-[400px]">
            {glossaryEntries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">용어집에 추가할 항목이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {paginatedGlossary.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} type="glossary" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Translations Column */}
        <div>
          <div className="bg-gradient-to-r from-[#66BB6A] to-[#5FA654] text-white px-4 py-3 rounded-t-lg">
            <h3 className="font-semibold">번역 ({translationEntries.length})</h3>
          </div>
          <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 bg-gray-50 min-h-[400px]">
            {translationEntries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">번역에 추가할 항목이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {paginatedTranslations.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} type="translation" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}

      {/* Duplicate Conflict Modal */}
      {showDuplicateModal && selectedEntry && (
        <DuplicateConflictModal
          entry={selectedEntry}
          onClose={() => {
            setShowDuplicateModal(false);
            setSelectedEntry(null);
          }}
          onSelectAction={handleDuplicateAction}
        />
      )}
    </div>
  );
}
