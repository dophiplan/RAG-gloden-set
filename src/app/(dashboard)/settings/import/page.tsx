'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ProductCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';
import { apiFetch } from '@/lib/api-utils';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [productCode, setProductCode] = useState<ProductCode | ''>('');
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch reference data from DB
  const { products } = useProducts();

  // Generate select options dynamically
  const productSelectOptions = [
    { value: '', label: '제품 선택' },
    ...products.map(p => ({ value: p.code, label: p.name }))
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('CSV 파일만 업로드 가능합니다.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    if (!productCode) {
      setError('제품을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('product_code', productCode);
      if (version) formData.append('version', version);

      const data = await apiFetch<{
        success: boolean;
        created: number;
        skipped: number;
        errors: string[];
        error?: string;
      }>('/api/import', {
        method: 'POST',
        body: formData,
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">스프레드시트 Import</h1>
            <p className="text-gray-600 mt-1">CSV 파일에서 번역 데이터를 가져옵니다.</p>
          </div>
        </div>

        {/* Product and Version Selection */}
        <Card>
          <CardTitle>제품 및 버전 선택</CardTitle>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Select
              label="제품 *"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value as ProductCode | '')}
              options={productSelectOptions}
            />
            <Input
              label="버전"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="예: 2.0.0"
            />
          </div>
        </Card>

        {/* File Format Guide */}
        <Card>
          <CardTitle>CSV 파일 형식</CardTitle>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-600">
              다음 열을 포함하는 CSV 파일을 준비하세요:
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left border-b">열 이름</th>
                    <th className="px-3 py-2 text-left border-b">필수</th>
                    <th className="px-3 py-2 text-left border-b">설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border-b font-mono">source_text</td>
                    <td className="px-3 py-2 border-b text-red-600">필수</td>
                    <td className="px-3 py-2 border-b">원문 텍스트</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b font-mono">context</td>
                    <td className="px-3 py-2 border-b text-gray-400">선택</td>
                    <td className="px-3 py-2 border-b">문맥/설명</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b font-mono">status</td>
                    <td className="px-3 py-2 border-b text-gray-400">선택</td>
                    <td className="px-3 py-2 border-b">상태 (pending, reviewed, deployed)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-b font-mono">ko, en, ja, ...</td>
                    <td className="px-3 py-2 border-b text-gray-400">선택</td>
                    <td className="px-3 py-2 border-b">각 언어별 번역</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">예시:</p>
              <pre className="text-xs text-gray-600 overflow-x-auto">
{`source_text,context,status,ko,en
"Login","로그인 버튼",pending,"로그인","Login"
"Sign up","회원가입 버튼",pending,"회원가입","Sign up"
"Welcome!","환영 메시지",reviewed,"환영합니다!","Welcome!"`}
              </pre>
            </div>
          </div>
        </Card>

        {/* Upload */}
        <Card>
          <CardTitle>파일 업로드</CardTitle>
          <div className="mt-4 space-y-4">
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${!productCode ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => productCode && document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={!productCode}
                className="hidden"
              />
              {file ? (
                <div>
                  <svg className="w-8 h-8 mx-auto text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    {productCode
                      ? 'CSV 파일을 선택하거나 드래그하세요'
                      : '먼저 제품을 선택해주세요'}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {result && (
              <div className={`
                px-4 py-3 rounded border
                ${result.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}
              `}>
                <p className="font-medium text-gray-900">가져오기 완료</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li className="text-green-700">생성됨: {result.created}개</li>
                  <li className="text-gray-600">건너뜀 (중복): {result.skipped}개</li>
                  {result.errors.length > 0 && (
                    <li className="text-red-600">
                      오류: {result.errors.length}개
                      <ul className="ml-4 mt-1">
                        {result.errors.slice(0, 5).map((err, i) => (
                          <li key={i} className="text-xs">{err}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li className="text-xs">... 외 {result.errors.length - 5}개</li>
                        )}
                      </ul>
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                disabled={!file || !productCode}
                loading={loading}
              >
                가져오기
              </Button>
              {file && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                    setError(null);
                  }}
                >
                  초기화
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Navigate to translations */}
        {result && result.created > 0 && (
          <div className="text-center">
            <Button
              variant="secondary"
              onClick={() => router.push(`/translations${productCode ? `?product=${productCode}` : ''}`)}
            >
              번역 관리로 이동
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
