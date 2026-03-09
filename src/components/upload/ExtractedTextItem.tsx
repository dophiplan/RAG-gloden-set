'use client';

import { ExtractedTextItemProps } from '@/types/upload';

export default function ExtractedTextItem({
  item,
  onToggle,
  onGlossaryAdd,
  onCopy,
}: ExtractedTextItemProps) {
  const { id, text, selected, glossaryMatch, duplicateCheck } = item;
  
  const isExactDuplicate = duplicateCheck?.status === 'exact_match';
  const isSimilarDuplicate = duplicateCheck?.status === 'similar';
  const isNewText = !duplicateCheck || duplicateCheck.status === 'new';

  const handleGlossaryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onGlossaryAdd(text);
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCopy(text);
  };

  return (
    <label
      className={`
        flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
        ${
          selected
            ? 'border-primary bg-green-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(id)}
        className="mt-0.5 w-4 h-4 text-[#818CF8] rounded border-gray-300 focus:ring-[#818CF8]"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-900 break-words flex-1">{text}</p>
          <button
            type="button"
            onClick={handleCopyClick}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
            title="복사"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        
        {/* 배지 영역 */}
        <div className="flex flex-wrap gap-2 mt-2">
          {/* 용어집 매칭 배지 */}
          {glossaryMatch?.exists ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              용어집 등록됨
              {glossaryMatch.translations && Object.keys(glossaryMatch.translations).length > 0 && (
                <span className="text-emerald-600">
                  ({Object.keys(glossaryMatch.translations).join(', ')})
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              용어집 미등록
            </span>
          )}

          {/* 중복 체크 배지 */}
          {isExactDuplicate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              이미 번역됨
              {duplicateCheck?.existingTranslation && (
                <span className="text-red-600 truncate max-w-[200px]">
                  : {duplicateCheck.existingTranslation}
                </span>
              )}
            </span>
          )}
          {isSimilarDuplicate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              유사 번역 존재
              {duplicateCheck?.similarity && (
                <span className="text-orange-600">
                  ({Math.round(duplicateCheck.similarity * 100)}%)
                </span>
              )}
            </span>
          )}
        </div>

        {/* 용어집 추가 버튼 (미등록인 경우) */}
        {!glossaryMatch?.exists && (
          <button
            type="button"
            onClick={handleGlossaryClick}
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary-hover bg-primary-light hover:bg-border rounded transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            용어집 추가
          </button>
        )}
      </div>
    </label>
  );
}
