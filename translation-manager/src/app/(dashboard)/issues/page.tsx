'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProductTabs from '@/components/ProductTabs';
import { Issue, ProductCode, IssueType, User } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isMaster } from '@/lib/permissions';
import { formatDateTimeKR } from '@/shared/date_time/date_formatter';
import { showError, showConfirm } from '@/lib/notifications';
import { useResizableColumns } from '@/hooks/useResizableColumns';

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  pdf_parse_error: 'PDF 파싱 오류',
  image_parse_error: '이미지 파싱 오류',
  duplicate_text: '중복 텍스트',
  validation_error: '검증 오류',
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const supabase = createClient();

  const fetchCurrentUser = async () => {
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
      console.error('Error fetching current user:', error);
    }
  };

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProduct) {
        params.set('product_code', selectedProduct);
      }

      const response = await fetch(`/api/issues?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Filter issues: Master sees all, users see their own
        if (currentUser && !isMaster(currentUser)) {
          setIssues(data.issues.filter((issue: Issue) => issue.user_id === currentUser.id));
        } else {
          setIssues(data.issues);
        }
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchIssues();
    }
  }, [selectedProduct, currentUser]);

  const handleResolveToggle = async (issueId: string, currentResolved: boolean) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !currentResolved }),
      });

      if (response.ok) {
        fetchIssues();
      } else {
        const errorData = await response.json();
        showError(errorData.error || '이슈 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating issue:', error);
      showError('이슈 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (issueId: string) => {
    if (!showConfirm('정말 이 이슈를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchIssues();
      } else {
        const errorData = await response.json();
        showError(errorData.error || '이슈 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
      showError('이슈 삭제 중 오류가 발생했습니다.');
    }
  };

  // Resizable columns setup
  const defaultWidths = {
    type: 140,
    description: 280,
    fileNames: 240,
    createdAt: 180,
    resolved: 100,
    actions: 120,
  };

  const minWidths = {
    type: 100,
    description: 180,
    fileNames: 150,
    createdAt: 120,
    resolved: 80,
    actions: 100,
  };

  const { columnWidths, startResize, resize, stopResize } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'issues-table-column-widths',
  });

  // Global mouse handlers for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e.clientX);
    const handleMouseUp = () => stopResize();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resize, stopResize]);

  // Helper to get cell style with width
  const getCellStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    return width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {};
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
            <p className="text-gray-600 mt-1">
              파일 파싱 및 검증 중 발생한 이슈를 관리합니다
            </p>
          </div>
        </div>

        {/* Product Tabs */}
        <ProductTabs
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
        />

        {/* Issues List */}
        <Card>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : issues.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              이슈가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('type')}>
                      타입
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('type', e.clientX); }} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('description')}>
                      설명
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('description', e.clientX); }} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('fileNames')}>
                      파일 이름
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('fileNames', e.clientX); }} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('createdAt')}>
                      생성일
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('createdAt', e.clientX); }} />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 relative group" style={getCellStyle('resolved')}>
                      해결됨
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('resolved', e.clientX); }} />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 relative group" style={getCellStyle('actions')}>
                      작업
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20" onMouseDown={(e) => { e.preventDefault(); startResize('actions', e.clientX); }} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {issues.map((issue) => (
                    <tr
                      key={issue.id}
                      className={`hover:bg-gray-50 ${
                        issue.resolved ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3" style={getCellStyle('type')}>
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            issue.issue_type === 'pdf_parse_error'
                              ? 'bg-red-100 text-red-800'
                              : issue.issue_type === 'image_parse_error'
                              ? 'bg-orange-100 text-orange-800'
                              : issue.issue_type === 'duplicate_text'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {ISSUE_TYPE_LABELS[issue.issue_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('description')}>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {issue.description}
                        </p>
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('fileNames')}>
                        <div className="text-sm text-gray-700">
                          {issue.file_names && issue.file_names.length > 0 ? (
                            <ul className="list-disc list-inside">
                              {issue.file_names.map((fileName, idx) => (
                                <li key={idx} className="truncate" title={fileName}>
                                  {fileName}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('createdAt')}>
                        <span className="text-sm text-gray-600">
                          {formatDateTimeKR(issue.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" style={getCellStyle('resolved')}>
                        <input
                          type="checkbox"
                          checked={issue.resolved}
                          onChange={() =>
                            handleResolveToggle(issue.id, issue.resolved)
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-right" style={getCellStyle('actions')}>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(issue.id)}
                        >
                          삭제
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600">전체 이슈</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {issues.length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600">미해결</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {issues.filter((i) => !i.resolved).length}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600">해결됨</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {issues.filter((i) => i.resolved).length}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
