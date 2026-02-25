'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ProductCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';
import MigrationPreviewTable from './components/MigrationPreviewTable';
import FieldMapping from './components/FieldMapping';
import { apiFetch } from '@/lib/api-utils';

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

interface Summary {
  total: number;
  glossary_suggested: number;
  translation_suggested: number;
  exact_matches: number;
  similar_matches: number;
  new_entries: number;
}

type Step = 'upload' | 'preview' | 'classify' | 'confirm';

interface PreviewResponse {
  entries: PreviewEntry[];
  summary: Summary;
  error?: string;
}

export default function MigrationPage() {
  const router = useRouter();
  const { products } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [productCode, setProductCode] = useState<ProductCode | 'ALL'>('ALL');
  const [version, setVersion] = useState('');
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasIssues, setHasIssues] = useState(false);
  
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [fieldMappings, setFieldMappings] = useState<{
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
  }>({
    source: null,
    translations: [],
    metadata: {},
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setFileColumns([]);
    setAvailableSheets([]);
    setSelectedSheet('');
    setFieldMappings({ source: null, translations: [], metadata: {} });

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv') {
        const text = await selectedFile.text();
        const firstLine = text.split('\n')[0];
        const cols = firstLine.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        setFileColumns(cols);
        setAvailableSheets(['Sheet1']);
        setSelectedSheet('Sheet1');
      } else {
        const buf = await selectedFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheets = wb.SheetNames;
        setAvailableSheets(sheets);
        
        if (sheets.length > 0) {
          const first = sheets[0];
          setSelectedSheet(first);
          const ws = wb.Sheets[first];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
          if (data.length > 0) {
            setFileColumns(data[0].map(h => String(h || '').trim()).filter(Boolean));
          }
        }
      }
    } catch (err) {
      setError('파일 읽기 오류: ' + (err as Error).message);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!file) return;
    setSelectedSheet(sheetName);
    setFieldMappings({ source: null, translations: [], metadata: {} });
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
      if (data.length > 0) {
        setFileColumns(data[0].map(h => String(h || '').trim()).filter(Boolean));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'simple') {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('product_code', productCode === 'ALL' ? '' : productCode);
        
        const previewData = await apiFetch<PreviewResponse>('/api/migration/preview', {
          method: 'POST',
          body: fd,
        });

        const hasDup = previewData.summary.exact_matches > 0;
        const hasSim = previewData.summary.similar_matches > 0;

        if (hasDup || hasSim) {
          const init = previewData.entries.map(e => ({
            ...e,
            category: e.suggested_category,
            action: (e.duplicate_status.status === 'exact' ? 'skip' : 'import') as 'skip' | 'import',
          }));
          setEntries(init);
          setSummary(previewData.summary);
          setHasIssues(true);
          setStep('classify');
        } else {
          const fd2 = new FormData();
          fd2.append('file', file);
          fd2.append('product_code', productCode === 'ALL' ? '' : productCode);
          fd2.append('mode', 'simple');
          
          const data = await apiFetch<{ glossary: { created: number } }>('/api/migration/commit', {
            method: 'POST',
            body: fd2,
          });
          
          alert(`가져오기 완료!\n\n용어집: ${data.glossary.created}개 추가`);
          router.push('/glossary');
        }
      } else {
        setStep('preview');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ glossary: { created: number; skipped: number }; translations: { created: number; updated: number; skipped: number } }>('/api/migration/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entries.map(e => ({
            id: e.id,
            source_text: e.source_text,
            context: e.context,
            translations: e.translations,
            category: e.category || e.suggested_category,
            action: e.action || 'import',
          })),
          product_code: productCode,
          version: version || null,
        }),
      });

      alert(`마이그레이션 완료!\n\n용어집: ${data.glossary.created}개 생성, ${data.glossary.skipped}개 건너뜀\n번역: ${data.translations.created}개 생성, ${data.translations.updated}개 업데이트, ${data.translations.skipped}개 건너뜀`);
      router.push('/translations');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (id: string, updates: Partial<PreviewEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const glossaryEntries = entries.filter(e => (e.category || e.suggested_category) === 'glossary');
  const translationEntries = entries.filter(e => (e.category || e.suggested_category) === 'translation');

  return (
    <DashboardLayout title="데이터 가져오기" subtitle="Excel/CSV 파일에서 용어집 및 번역 데이터를 가져옵니다.">
      <div className="max-w-7xl mx-auto">
        {/* Mode Toggle */}
        <div className="mb-6 flex items-center justify-center gap-2 p-1 bg-gray-100 rounded-lg w-fit mx-auto">
          <button onClick={() => setMode('simple')} className={`px-6 py-2 rounded-md font-medium transition-all ${mode === 'simple' ? 'bg-white text-[#818CF8] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <span className="flex items-center gap-2"><span>⚡</span><span>간단 모드</span></span>
          </button>
          <button onClick={() => setMode('advanced')} className={`px-6 py-2 rounded-md font-medium transition-all ${mode === 'advanced' ? 'bg-white text-[#818CF8] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <span className="flex items-center gap-2"><span>🔧</span><span>고급 모드</span></span>
          </button>
        </div>

        {/* Mode Description */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">{mode === 'simple' ? '⚡' : '🔧'}</span>
            <p className="text-sm text-blue-900">
              {mode === 'simple' 
                ? '간단 모드 - 용어집에 빠르게 추가합니다. 중복이 없으면 바로 가져오고, 중복이 있으면 확인 후 진행합니다.'
                : '고급 모드 - 미리보기를 통해 각 항목을 확인하고, 중복 처리 방법을 선택할 수 있습니다.'}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        {mode === 'advanced' && (
          <div className="mb-8">
            <div className="flex items-center justify-center">
              {['upload', 'preview', 'classify', 'confirm'].map((s, i) => (
                <React.Fragment key={s}>
                  <button onClick={() => setStep(s as Step)} className="flex items-center cursor-pointer hover:opacity-80">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step === s ? 'bg-[#818CF8] text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {i + 1}
                    </div>
                    <span className={`ml-2 font-medium ${step === s ? 'text-[#818CF8]' : 'text-gray-600'}`}>
                      {s === 'upload' ? '업로드' : s === 'preview' ? '미리보기' : s === 'classify' ? '분류' : '확인 및 실행'}
                    </span>
                  </button>
                  {i < 3 && <div className="w-16 h-1 mx-2 bg-gray-200" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">{mode === 'simple' ? '파일 선택' : '파일 업로드'}</h2>

            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Excel/CSV 파일 선택</label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center h-24 px-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-[#818CF8] transition-all"
                >
                  <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-1 text-sm text-gray-600"><span className="font-semibold">클릭하여 파일 선택</span></p>
                  <p className="text-xs text-gray-500">CSV, XLSX, XLS 파일 지원</p>
                </button>

                {/* Selected file display */}
                {file && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-blue-900">{file.name}</span>
                        <span className="text-xs text-blue-600">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={() => {
                          setFile(null);
                          setFileColumns([]);
                          setAvailableSheets([]);
                          setSelectedSheet('');
                          setFieldMappings({ source: null, translations: [], metadata: {} });
                          setError('');
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Sheet selection */}
                    {availableSheets.length > 1 && (
                      <div className="border-t border-blue-200 pt-2 mt-2">
                        <label className="block text-xs font-medium text-blue-700 mb-1">시트 선택 ({availableSheets.length}개)</label>
                        <select
                          value={selectedSheet}
                          onChange={(e) => handleSheetChange(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded text-sm"
                        >
                          {availableSheets.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                        </select>
                      </div>
                    )}
                    
                    {/* Column info */}
                    {fileColumns.length > 0 && (
                      <div className="border-t border-blue-200 pt-2 mt-2">
                        <p className="text-xs text-blue-700">감지된 컬럼: <span className="font-semibold">{fileColumns.length}개</span></p>
                        <p className="text-xs text-blue-600 truncate">{fileColumns.slice(0, 5).join(', ')}{fileColumns.length > 5 && ` 외 ${fileColumns.length - 5}개`}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">제품 선택</label>
                <select
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value as ProductCode | 'ALL')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8]"
                >
                  {mode === 'simple' && <option value="ALL">전체 (모든 제품 공통)</option>}
                  {products.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>

              {/* Version (Advanced only) */}
              {mode === 'advanced' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">버전 (선택사항)</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="예: v1.0.0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8]"
                  />
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '처리 중...' : mode === 'simple' ? '바로 가져오기' : fileColumns.length > 0 ? '다음 단계' : '파일 업로드 필요'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">필드 매핑</h2>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 왼쪽 파일 필드를 드래그해서 오른쪽 시스템 필드에 매칭하세요.
              </p>
            </div>
            
            {fileColumns.length > 0 ? (
              <FieldMapping
                fileColumns={fileColumns}
                onMappingChange={setFieldMappings}
                initialMappings={fieldMappings}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">파일을 먼저 업로드해주세요.</p>
                <button onClick={() => setStep('upload')} className="mt-4 px-4 py-2 bg-[#818CF8] text-white rounded-lg text-sm">파일 업로드하러 가기</button>
              </div>
            )}
            
            <div className="flex gap-4 mt-6">
              <button onClick={() => setStep('upload')} className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">이전</button>
              <button
                onClick={() => {
                  if (!fieldMappings.source) { alert('원문 필드는 필수 매핑입니다.'); return; }
                  if (fieldMappings.translations.length === 0) { alert('최소 하나의 번역 언어를 선택해주세요.'); return; }
                  setStep('classify');
                }}
                disabled={fileColumns.length === 0 || !fieldMappings.source || fieldMappings.translations.length === 0}
                className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {fileColumns.length === 0 ? '파일 업로드 필요' : !fieldMappings.source ? '원문 매핑 필요' : fieldMappings.translations.length === 0 ? '번역 언어 필요' : '분류로 이동'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Classify */}
        {step === 'classify' && summary && (
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">분류</h2>
              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="text-center"><p className="text-2xl font-bold text-gray-900">{summary.total}</p><p className="text-sm text-gray-600">전체</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-[#818CF8]">{glossaryEntries.length}</p><p className="text-sm text-gray-600">용어집</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-[#6366F1]">{translationEntries.length}</p><p className="text-sm text-gray-600">번역</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{summary.new_entries}</p><p className="text-sm text-gray-600">신규</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-yellow-600">{summary.exact_matches + summary.similar_matches}</p><p className="text-sm text-gray-600">중복/유사</p></div>
              </div>
            </div>

            {mode === 'simple' && hasIssues && (
              <div className="space-y-4 mb-6">
                {summary.exact_matches > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-900 mb-1">중복 항목: {summary.exact_matches}개</h3>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setEntries(prev => prev.map(e => e.duplicate_status.status === 'exact' ? { ...e, action: 'overwrite' } : e))} className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700">모두 덮어쓰기</button>
                          <button onClick={() => setEntries(prev => prev.map(e => e.duplicate_status.status === 'exact' ? { ...e, action: 'skip' } : e))} className="px-3 py-1 text-sm border border-yellow-600 text-yellow-700 rounded hover:bg-yellow-50">모두 건너뛰기</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <MigrationPreviewTable
              glossaryEntries={glossaryEntries}
              translationEntries={translationEntries}
              onUpdateEntry={updateEntry}
            />

            <div className="flex gap-4 mt-6">
              <button onClick={() => setStep(mode === 'advanced' ? 'preview' : 'upload')} className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">이전</button>
              <button onClick={() => setStep('confirm')} className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1]">다음 단계</button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">확인 및 실행</h2>

            <div className="space-y-4 mb-6">
              <div className="border-b pb-4">
                <h3 className="font-semibold text-gray-900 mb-2">용어집</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-gray-600">추가</p><p className="text-lg font-semibold text-[#818CF8]">{glossaryEntries.filter(e => e.action === 'import' || e.action === 'merge' || e.action === 'overwrite').length}건</p></div>
                  <div><p className="text-gray-600">건너뛰기</p><p className="text-lg font-semibold text-gray-600">{glossaryEntries.filter(e => e.action === 'skip').length}건</p></div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-gray-900 mb-2">번역</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-gray-600">추가</p><p className="text-lg font-semibold text-[#6366F1]">{translationEntries.filter(e => e.action === 'import').length}건</p></div>
                  <div><p className="text-gray-600">병합</p><p className="text-lg font-semibold text-blue-600">{translationEntries.filter(e => e.action === 'merge').length}건</p></div>
                  <div><p className="text-gray-600">건너뛰기</p><p className="text-lg font-semibold text-gray-600">{translationEntries.filter(e => e.action === 'skip').length}건</p></div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">⚠️ 마이그레이션을 실행하면 선택한 항목이 데이터베이스에 추가됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep('classify')} disabled={loading} className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50">이전</button>
              <button onClick={handleCommit} disabled={loading} className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed">
                {loading ? '마이그레이션 중...' : '마이그레이션 실행'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
