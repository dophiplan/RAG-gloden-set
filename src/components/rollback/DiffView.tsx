'use client';

import { useMemo } from 'react';

interface DiffViewProps {
  oldValue: string | null;
  newValue: string | null;
  userName?: string | null;
  userColor?: string;
  showInline?: boolean;
}

// 사용자별 색상 팔레트 (12가지 색상)
const userColorPalette = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', light: 'bg-blue-50' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', light: 'bg-green-50' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', light: 'bg-purple-50' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', light: 'bg-orange-50' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', light: 'bg-pink-50' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', light: 'bg-teal-50' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', light: 'bg-indigo-50' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', light: 'bg-amber-50' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', light: 'bg-cyan-50' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', light: 'bg-rose-50' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', light: 'bg-emerald-50' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', light: 'bg-violet-50' },
];

// 사용자 이름을 기반으로 색상 인덱스 생성
export function getUserColorIndex(userName: string | null | undefined): number {
  if (!userName) return 0;
  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    const char = userName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % userColorPalette.length;
}

// 사용자 색상 가져오기
export function getUserColors(userName: string | null | undefined) {
  const index = getUserColorIndex(userName);
  return userColorPalette[index];
}

// 단어 단위 diff 계산 (성능 최적화 버전)
const MAX_TOKENS = 500; // 최대 토큰 수 제한

function computeWordDiff(oldText: string, newText: string): Array<{ type: 'same' | 'removed' | 'added'; text: string }> {
  // 긴 텍스트는 간단한 비교만 수행
  if (oldText.length > 5000 || newText.length > 5000) {
    return [
      { type: 'removed', text: oldText.slice(0, 200) + (oldText.length > 200 ? '...' : '') },
      { type: 'added', text: newText.slice(0, 200) + (newText.length > 200 ? '...' : '') },
    ];
  }

  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // 토큰 수 제한
  if (oldWords.length > MAX_TOKENS || newWords.length > MAX_TOKENS) {
    return [
      { type: 'removed', text: oldText.slice(0, 200) + '...' },
      { type: 'added', text: newText.slice(0, 200) + '...' },
    ];
  }
  
  const result: Array<{ type: 'same' | 'removed' | 'added'; text: string }> = [];
  let oldIdx = 0;
  let newIdx = 0;
  
  // Set을 사용한 성능 최적화
  const newWordsSet = new Set(newWords);
  const oldWordsSet = new Set(oldWords);
  
  while (oldIdx < oldWords.length || newIdx < newWords.length) {
    const oldWord = oldWords[oldIdx];
    const newWord = newWords[newIdx];
    
    if (oldWord === newWord) {
      // 같은 단어
      if (oldWord !== undefined) {
        result.push({ type: 'same', text: oldWord });
      }
      oldIdx++;
      newIdx++;
    } else if (newWordsSet.has(oldWord)) {
      // oldWord가 newWords에 있음 (뒤에 있음) → 추가된 단어
      if (newWord !== undefined) {
        result.push({ type: 'added', text: newWord });
        newIdx++;
      } else {
        oldIdx++;
      }
    } else if (oldWordsSet.has(newWord)) {
      // newWord가 oldWords에 있음 (뒤에 있음) → 삭제된 단어
      if (oldWord !== undefined) {
        result.push({ type: 'removed', text: oldWord });
        oldIdx++;
      } else {
        newIdx++;
      }
    } else {
      // 둘 다 다름
      if (oldWord !== undefined) {
        result.push({ type: 'removed', text: oldWord });
        oldIdx++;
      }
      if (newWord !== undefined) {
        result.push({ type: 'added', text: newWord });
        newIdx++;
      }
    }
  }
  
  return result;
}

// 줄 단위 diff 계산
function computeLineDiff(oldText: string, newText: string): Array<{ type: 'same' | 'removed' | 'added'; lines: string[] }> {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const result: Array<{ type: 'same' | 'removed' | 'added'; lines: string[] }> = [];
  let oldIdx = 0;
  let newIdx = 0;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];
    
    if (oldLine === newLine) {
      if (oldLine !== undefined) {
        result.push({ type: 'same', lines: [oldLine] });
      }
      oldIdx++;
      newIdx++;
    } else if (newLines.slice(newIdx).includes(oldLine)) {
      result.push({ type: 'added', lines: [newLine] });
      newIdx++;
    } else if (oldLines.slice(oldIdx).includes(newLine)) {
      result.push({ type: 'removed', lines: [oldLine] });
      oldIdx++;
    } else {
      if (oldLine !== undefined) {
        result.push({ type: 'removed', lines: [oldLine] });
        oldIdx++;
      }
      if (newLine !== undefined) {
        result.push({ type: 'added', lines: [newLine] });
        newIdx++;
      }
    }
  }
  
  return result;
}

export default function DiffView({ 
  oldValue, 
  newValue, 
  userName,
  userColor,
  showInline = false 
}: DiffViewProps) {
  const colors = useMemo(() => {
    if (userColor) {
      const index = parseInt(userColor) % userColorPalette.length;
      return userColorPalette[index];
    }
    return getUserColors(userName);
  }, [userName, userColor]);
  
  const oldText = oldValue || '';
  const newText = newValue || '';
  
  // 짧은 텍스트는 인라인, 긴 텍스트는 라인 단위
  const isLongText = oldText.length > 100 || newText.length > 100 || oldText.includes('\n') || newText.includes('\n');
  
  // 모든 diff 미리 계산 (조걶 없이)
  const wordDiff = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  const lineDiff = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);
  
  if (showInline || !isLongText) {
    // 인라인 diff (단어 단위)
    
    return (
      <div className="space-y-2">
        {/* Before / After 레이블 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">Before</span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">After</span>
          {userName && (
            <span className={`ml-auto px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
              {userName}
            </span>
          )}
        </div>
        
        {/* Diff 내용 */}
        <div className="text-sm font-mono bg-gray-50 p-3 rounded border border-gray-200">
          {wordDiff.map((part, idx) => (
            <span
              key={idx}
              className={
                part.type === 'removed'
                  ? 'bg-red-100 text-red-800 line-through decoration-red-500'
                  : part.type === 'added'
                  ? 'bg-green-100 text-green-800'
                  : 'text-gray-700'
              }
            >
              {part.text}
            </span>
          ))}
        </div>
      </div>
    );
  }
  
  // 라인 단위 diff는 위에서 이미 계산됨
  
  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">삭제됨</span>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">추가됨</span>
        {userName && (
          <span className={`ml-auto px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
            {userName}
          </span>
        )}
      </div>
      
      {/* 라인별 diff */}
      <div className="font-mono text-sm border border-gray-200 rounded overflow-hidden">
        {lineDiff.map((part, idx) => (
          <div
            key={idx}
            className={
              part.type === 'removed'
                ? 'bg-red-50 border-l-4 border-red-400'
                : part.type === 'added'
                ? 'bg-green-50 border-l-4 border-green-400'
                : 'bg-white border-l-4 border-gray-200'
            }
          >
            {part.lines.map((line, lineIdx) => (
              <div key={lineIdx} className="px-3 py-1 flex">
                <span className="w-6 shrink-0 text-gray-400 select-none">
                  {part.type === 'removed' ? '-' : part.type === 'added' ? '+' : ' '}
                </span>
                <span
                  className={
                    part.type === 'removed'
                      ? 'text-red-800'
                      : part.type === 'added'
                      ? 'text-green-800'
                      : 'text-gray-700'
                  }
                >
                  {line || ' '}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// 사용자 아바타 (이니셜 + 색상)
interface UserAvatarProps {
  userName: string | null;
  userEmail?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ userName, userEmail, size = 'md' }: UserAvatarProps) {
  const colors = useMemo(() => getUserColors(userName || userEmail), [userName, userEmail]);
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };
  
  const initial = (userName || userEmail || '?').charAt(0).toUpperCase();
  
  return (
    <div
      className={`${sizeClasses[size]} ${colors.bg} ${colors.text} rounded-full flex items-center justify-center font-semibold border ${colors.border}`}
      title={userName || userEmail}
    >
      {initial}
    </div>
  );
}

// 타임라인 뷰 (여러 변경 이력을 시각적으로 표시)
interface TimelineViewProps {
  items: Array<{
    id: string;
    userName: string | null;
    userEmail: string;
    action: string;
    createdAt: string;
    oldValue?: string | null;
    newValue?: string | null;
    isSelected?: boolean;
  }>;
  onSelect?: (id: string) => void;
}

export function TimelineView({ items, onSelect }: TimelineViewProps) {
  return (
    <div className="relative pl-4">
      {/* 타임라인 선 */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      {items.map((item) => {
        const colors = getUserColors(item.userName || item.userEmail);
        
        return (
          <div
            key={item.id}
            className={`relative mb-4 cursor-pointer transition-all ${
              item.isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            }`}
            onClick={() => onSelect?.(item.id)}
          >
            {/* 타임라인 점 */}
            <div
              className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white ${colors.bg.replace('bg-', 'bg-').replace('100', '500')} ${
                item.isSelected ? 'ring-2 ring-offset-2 ring-gray-300' : ''
              }`}
            />
            
            {/* 내용 */}
            <div className={`p-3 rounded-lg border ${item.isSelected ? colors.border : 'border-gray-200'} ${item.isSelected ? colors.light : 'bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar userName={item.userName} userEmail={item.userEmail} size="sm" />
                <span className="text-sm font-medium">{item.userName || item.userEmail}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(item.createdAt).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              
              {item.oldValue !== undefined && item.newValue !== undefined && (
                <div className="mt-2">
                  <DiffView
                    oldValue={item.oldValue}
                    newValue={item.newValue}
                    showInline
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
