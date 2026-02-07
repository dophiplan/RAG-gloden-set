'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UserManagementTable from '@/components/UserManagementTable';
import { createClient } from '@/lib/supabase/client';
import { canManageAccounts } from '@/lib/permissions';
import { User } from '@/types';
import { showError } from '@/lib/notifications';

export default function AccountsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [supabase]);

  const downloadSampleExcel = () => {
    // Create sample data
    const sampleData = [
      ['email', 'name', 'roles', 'work_products', 'work_scope', 'work_languages'],
      ['user@example.com', 'John Doe', 'translator_en,reviewer_en', 'RC,RV', 'iOS,Android', 'en,ja'],
      ['another@example.com', 'Jane Smith', 'pm,requester', 'RM,Rfice', 'Web', 'en,zh-CN'],
    ];

    // Convert to CSV
    const csv = sampleData.map(row => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'user_import_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      showError('Excel 또는 CSV 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({
          success: data.success,
          failed: data.failed,
          errors: data.errors || [],
        });
      } else {
        showError(data.error || '업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Check permission
  if (!canManageAccounts(currentUser)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h1>
          <p className="text-gray-600">이 페이지는 Master 권한이 필요합니다.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계정 관리</h1>
          <p className="text-gray-600 mt-1">
            사용자 계정 및 권한을 관리합니다.
          </p>
        </div>

        {/* Excel Upload Section */}
        <Card>
          <CardTitle>Excel 일괄 업로드</CardTitle>
          <div className="mt-4 space-y-4">
            {/* Sample Download Button */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="font-medium text-blue-900">샘플 파일 다운로드</p>
                <p className="text-sm text-blue-700">
                  Excel 업로드 형식을 확인하세요
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={downloadSampleExcel}
              >
                샘플 다운로드
              </Button>
            </div>

            {/* Drag and Drop Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }
              `}
            >
              <div className="space-y-4">
                <div className="text-5xl">📊</div>
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Excel 파일을 여기에 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    .xlsx, .xls, .csv 파일 지원
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  <label htmlFor="file-upload">
                    <span className="inline-block cursor-pointer">
                      <Button
                        variant="primary"
                        loading={uploading}
                        disabled={uploading}
                      >
                        {uploading ? '업로드 중...' : '파일 선택'}
                      </Button>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div
                className={`p-4 rounded-lg ${
                  uploadResult.failed === 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {uploadResult.failed === 0 ? '✅' : '⚠️'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      업로드 결과
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-green-700">
                        성공: {uploadResult.success}명
                      </p>
                      {uploadResult.failed > 0 && (
                        <>
                          <p className="text-red-700">
                            실패: {uploadResult.failed}명
                          </p>
                          {uploadResult.errors.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-900">오류 내역:</p>
                              <ul className="list-disc list-inside text-gray-700 mt-1">
                                {uploadResult.errors.map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* User Management Table */}
        <Card>
          <CardTitle>사용자 목록</CardTitle>
          <div className="mt-4">
            <UserManagementTable />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
