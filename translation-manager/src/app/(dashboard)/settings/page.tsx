'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { SUPPORTED_LANGUAGES } from '@/types';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [name, setName] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isRsupportUser, setIsRsupportUser] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [apiKeyMessage, setApiKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profile) {
            setUser(profile);
            setName(profile.name || '');
          } else {
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              name: null,
            });
          }

          // Check if user is from rsupport.com domain
          const email = authUser.email || '';
          const isRsupport = email.endsWith('@rsupport.com');
          setIsRsupportUser(isRsupport);

          // For @rsupport.com users, check organization API key
          if (isRsupport) {
            const orgResponse = await fetch('/api/organization/settings');
            if (orgResponse.ok) {
              const { settings: orgSettings } = await orgResponse.json();
              if (orgSettings?.openai_api_key) {
                setHasApiKey(true);
              }
            }
          } else {
            // For other users, check individual API key
            const { data: settings } = await supabase
              .from('user_settings')
              .select('openai_api_key')
              .eq('user_id', authUser.id)
              .single();

            if (settings?.openai_api_key) {
              setHasApiKey(true);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [supabase]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          name: name || null,
        });

      if (error) throw error;

      setUser({ ...user, name });
      setMessage({ type: 'success', text: '프로필이 저장되었습니다.' });
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: '프로필 저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!user) return;

    setSavingApiKey(true);
    setApiKeyMessage(null);

    try {
      let response;

      if (isRsupportUser) {
        // @rsupport.com users save to organization settings
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openai_api_key: openaiApiKey }),
        });
      } else {
        // Other users save to personal settings
        response = await fetch('/api/settings/openai-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: openaiApiKey }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'API 키 저장 실패');
      }

      setHasApiKey(!!openaiApiKey);
      setOpenaiApiKey('');
      const keyType = isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키';
      setApiKeyMessage({ type: 'success', text: `${keyType}가 저장되었습니다.` });
    } catch (error) {
      console.error('Error saving API key:', error);
      setApiKeyMessage({ type: 'error', text: error instanceof Error ? error.message : 'API 키 저장에 실패했습니다.' });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!user) return;
    const keyType = isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키';
    if (!confirm(`${keyType}를 삭제하시겠습니까?${isRsupportUser ? ' (조직 전체에 영향을 미칩니다)' : ''}`)) return;

    setSavingApiKey(true);
    setApiKeyMessage(null);

    try {
      let response;

      if (isRsupportUser) {
        // @rsupport.com users delete from organization settings
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openai_api_key: null }),
        });
      } else {
        // Other users delete from personal settings
        response = await fetch('/api/settings/openai-key', {
          method: 'DELETE',
        });
      }

      if (!response.ok) {
        throw new Error('API 키 삭제 실패');
      }

      setHasApiKey(false);
      setApiKeyMessage({ type: 'success', text: `${keyType}가 삭제되었습니다.` });
    } catch (error) {
      console.error('Error deleting API key:', error);
      setApiKeyMessage({ type: 'error', text: 'API 키 삭제에 실패했습니다.' });
    } finally {
      setSavingApiKey(false);
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

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-gray-600 mt-1">계정 및 환경 설정을 관리합니다.</p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardTitle>프로필</CardTitle>
          <div className="mt-4 space-y-4">
            <Input
              label="이메일"
              value={user?.email || ''}
              disabled
              className="bg-gray-50"
            />
            <Input
              label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
            />

            {message && (
              <div
                className={`p-3 rounded ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button onClick={handleSaveProfile} loading={saving}>
              저장
            </Button>
          </div>
        </Card>

        {/* OpenAI API Key Settings */}
        <Card>
          <CardTitle>
            {isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키'}
            {isRsupportUser && (
              <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                조직 전체 공유
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {isRsupportUser
              ? '@rsupport.com 계정은 조직 전체가 공유하는 API 키를 사용합니다. AI 자동 번역 기능에 사용됩니다.'
              : 'AI 자동 번역 기능을 사용하려면 OpenAI API 키가 필요합니다.'
            }
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">현재 상태</p>
                <p className="text-sm text-gray-500">
                  {hasApiKey ?
                    (isRsupportUser ? '조직 API 키가 설정되어 있습니다.' : 'API 키가 설정되어 있습니다.')
                    : (isRsupportUser ? '조직 API 키가 설정되지 않았습니다.' : 'API 키가 설정되지 않았습니다.')
                  }
                </p>
              </div>
              <Badge variant={hasApiKey ? 'success' : 'warning'}>
                {hasApiKey ? '설정됨' : '미설정'}
              </Badge>
            </div>

            <Input
              label={hasApiKey ? '새 API 키 (변경시에만 입력)' : 'API 키 *'}
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
            />

            {apiKeyMessage && (
              <div
                className={`p-3 rounded ${
                  apiKeyMessage.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {apiKeyMessage.text}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveApiKey}
                loading={savingApiKey}
                disabled={!openaiApiKey}
              >
                {hasApiKey ? 'API 키 변경' : 'API 키 저장'}
              </Button>
              {hasApiKey && (
                <Button
                  variant="danger"
                  onClick={handleDeleteApiKey}
                  loading={savingApiKey}
                >
                  API 키 삭제
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-400">
              API 키는 암호화되어 안전하게 저장됩니다. OpenAI API 키는{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                OpenAI 대시보드
              </a>
              에서 발급받을 수 있습니다.
            </p>
          </div>
        </Card>

        {/* Language Settings */}
        <Card>
          <CardTitle>지원 언어</CardTitle>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            시스템에서 지원하는 번역 언어 목록입니다.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <div
                key={code}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <Badge variant="info">{code}</Badge>
                <span className="text-sm text-gray-700">{name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <CardTitle>데이터 관리</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">스프레드시트 Import</p>
                <p className="text-sm text-gray-500">CSV 파일에서 번역 데이터 가져오기</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => window.location.href = '/settings/import'}>
                Import
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">번역 Export</p>
                <p className="text-sm text-gray-500">모든 번역 데이터를 CSV로 내보내기</p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                준비 중
              </Button>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <CardTitle>정보</CardTitle>
          <div className="mt-4 text-sm text-gray-500 space-y-2">
            <p>Translation Resource Manager v1.1.0</p>
            <p>기획서 PDF에서 번역 대상 텍스트를 추출하고, 번역 상태를 관리하는 웹 서비스입니다.</p>
            <p className="text-xs text-gray-400 mt-4">
              Built with Next.js, Supabase, OpenAI, and Tailwind CSS
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
