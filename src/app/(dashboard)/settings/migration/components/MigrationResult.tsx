'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { CommitResponse } from '../contexts/MigrationContext';

interface MigrationResultProps {
  results: CommitResponse;
  onReset: () => void;
  onClose: () => void;
}

export default function MigrationResult({ results, onReset, onClose }: MigrationResultProps) {
  const totalProcessed = 
    (results.glossary?.created || 0) + 
    (results.glossary?.skipped || 0) +
    (results.translations?.created || 0) + 
    (results.translations?.updated || 0) + 
    (results.translations?.skipped || 0);
  
  const totalCreated = (results.glossary?.created || 0) + (results.translations?.created || 0);
  const totalUpdated = results.translations?.updated || 0;
  const totalSkipped = (results.glossary?.skipped || 0) + (results.translations?.skipped || 0);
  const totalErrors = (results.glossary?.errors?.length || 0) + (results.translations?.errors?.length || 0);
  
  const hasErrors = totalErrors > 0;
  const allSkipped = totalCreated === 0 && totalUpdated === 0 && !hasErrors;
  
  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center py-8">
        {allSkipped ? (
          <>
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">모든 항목이 건Skipped</h2>
            <p className="text-gray-600">
              모든 항목이 이미 시스템에 존재하여 마이그레이션되지 않았습니다.
            </p>
          </>
        ) : hasErrors ? (
          <>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">마이그레이션 완료 (일부 오류)</h2>
            <p className="text-gray-600">
              일부 항목에 오류가 발생했습니다. 아래 내용을 확인해주세요.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">마이그레이션 완료</h2>
            <p className="text-gray-600">
              데이터가 성공적으로 마이그레이션되었습니다.
            </p>
          </>
        )}
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-emerald-600">{totalCreated}</div>
          <div className="text-sm text-gray-600">신규 생성</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-blue-600">{totalUpdated}</div>
          <div className="text-sm text-gray-600">업데이트</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-yellow-600">{totalSkipped}</div>
          <div className="text-sm text-gray-600">Skipped</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
          <div className="text-sm text-gray-600">오류</div>
        </Card>
      </div>
      
      {/* Detailed Results */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상세 결과</h3>
        
        {/* Glossary Results */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">용어집 (Glossary)</h4>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">신규 생성</span>
              <span className="font-medium text-emerald-600">{results.glossary?.created || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Skipped</span>
              <span className="font-medium text-yellow-600">{results.glossary?.skipped || 0}</span>
            </div>
            {results.glossary?.errors && results.glossary.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-red-600 text-xs">오류: {results.glossary.errors.length}건</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Translations Results */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">번역 데이터 (Translations)</h4>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">신규 생성</span>
              <span className="font-medium text-emerald-600">{results.translations?.created || 0}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">업데이트</span>
              <span className="font-medium text-blue-600">{results.translations?.updated || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Skipped</span>
              <span className="font-medium text-yellow-600">{results.translations?.skipped || 0}</span>
            </div>
            {results.translations?.errors && results.translations.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-red-600 text-xs">오류: {results.translations.errors.length}건</span>
              </div>
            )}
          </div>
        </div>
        
        {results.processingTimeMs && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-right">
            처리 시간: {(results.processingTimeMs / 1000).toFixed(2)}초
          </div>
        )}
      </Card>
      
      {/* Errors (if any) */}
      {hasErrors && (
        <Card className="border-red-200 bg-red-50">
          <h3 className="text-sm font-semibold text-red-800 mb-2">오류 내역</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {results.glossary?.errors?.map((err, idx) => (
              <div key={`g-${idx}`} className="text-xs text-red-700">
                용어집: {err}
              </div>
            ))}
            {results.translations?.errors?.map((err, idx) => (
              <div key={`t-${idx}`} className="text-xs text-red-700">
                번역: {err}
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        <Button variant="secondary" size="lg" onClick={onClose}>
          미리보기로 돌아가기
        </Button>
        <Button variant="primary" size="lg" onClick={onReset}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로운 마이그레이션
          </span>
        </Button>
      </div>
    </div>
  );
}
