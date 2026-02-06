'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileUploader, { UploadedFile } from '@/components/FileUploader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';

const scopeOptions = [
  { value: '', label: '제품 분류 선택 *' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Solution', label: 'Solution' },
];

interface ParseResult {
  success: boolean;
  extracted_texts?: string[];
  total_extracted?: number;
  issues_created?: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scope, setScope] = useState<'SaaS' | 'Solution' | ''>('');
  const [version, setVersion] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setParseResult(null);
    setError(null);
  };

  const handleParse = async () => {
    if (uploadedFiles.length === 0) {
      setError('파일을 업로드해주세요.');
      return;
    }

    if (!scope) {
      setError('제품 분류를 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setParseResult(null);

    try {
      const formData = new FormData();

      // Append all files
      uploadedFiles.forEach((uploadedFile) => {
        formData.append('files', uploadedFile.file);
      });

      // Append metadata
      if (scope) formData.append('scope', scope);
      if (version) formData.append('version', version);

      const response = await fetch('/api/files/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '파일 파싱에 실패했습니다.');
      }

      setParseResult(data);

      // If parsing was successful, optionally redirect or show results
      if (data.success && data.extracted_texts && data.extracted_texts.length > 0) {
        // Success - show results
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewIssues = () => {
    router.push('/issues');
  };

  const handleAddTranslations = () => {
    if (parseResult?.extracted_texts && parseResult.extracted_texts.length > 0) {
      const params = new URLSearchParams();
      params.set('new', encodeURIComponent(JSON.stringify(parseResult.extracted_texts)));
      if (version) params.set('version', version);
      if (scope) params.set('scope', scope);
      router.push(`/translations?${params}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">파일 업로드</h1>
        <p className="text-gray-600 mb-8">
          기획서 PDF 또는 이미지를 업로드하면 따옴표로 감싼 텍스트를 자동으로 추출합니다.
          파싱에 실패한 경우 이슈로 등록되어 나중에 확인할 수 있습니다.
        </p>

        {/* Configuration */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="제품 분류 *"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'SaaS' | 'Solution' | '')}
              options={scopeOptions}
            />
            <Input
              label="버전"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="예: 2.0.0"
            />
          </div>
        </Card>

        {/* File Uploader */}
        <Card className="mb-6">
          <FileUploader
            onFilesChange={handleFilesChange}
            maxPdfFiles={5}
            maxImageFiles={10}
          />
        </Card>

        {/* Upload Button */}
        {uploadedFiles.length > 0 && (
          <Card className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {uploadedFiles.length}개 파일 준비됨
                </p>
                {scope && (
                  <Badge variant="info" className="mt-1">
                    {scope}
                  </Badge>
                )}
                {version && (
                  <Badge variant="warning" className="mt-1 ml-2">
                    v{version}
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleParse}
                loading={isUploading}
                disabled={isUploading || !scope}
              >
                {isUploading ? '파싱 중...' : '파일 파싱'}
              </Button>
            </div>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                {parseResult?.issues_created && parseResult.issues_created.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleViewIssues}
                    className="mt-3"
                  >
                    이슈 확인
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Parse Results */}
        {parseResult && parseResult.success && (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">파싱 완료</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {parseResult.total_extracted || 0}개의 텍스트를 추출했습니다.
                  </p>
                </div>
                <Badge variant="success">완료</Badge>
              </div>

              {/* Issues Created */}
              {parseResult.issues_created && parseResult.issues_created.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                        파싱 실패 항목이 이슈로 등록되었습니다
                      </h4>
                      <p className="text-sm text-yellow-700 mb-2">
                        {parseResult.issues_created.length}개의 이슈가 생성되었습니다.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleViewIssues}
                      >
                        이슈 확인
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Texts Preview */}
              {parseResult.extracted_texts && parseResult.extracted_texts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    추출된 텍스트 (처음 10개)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {parseResult.extracted_texts.slice(0, 10).map((text, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <p className="text-sm text-gray-900">{text}</p>
                      </div>
                    ))}
                    {parseResult.extracted_texts.length > 10 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        ... 외 {parseResult.extracted_texts.length - 10}개
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleAddTranslations}>
                  번역 항목으로 추가
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUploadedFiles([]);
                    setParseResult(null);
                    setError(null);
                  }}
                >
                  초기화
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
