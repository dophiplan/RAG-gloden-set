'use client';

import { useState, useEffect } from 'react';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';

export type AIProvider = 'openai' | 'claude' | 'kimi' | 'gemini';

interface AIProviderConfig {
  id: AIProvider;
  name: string;
  displayName: string;
  keyField: string;
  icon: string;
  color: string;
  description: string;
  websiteUrl: string;
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI',
    keyField: 'openai_api_key',
    icon: '🤖',
    color: 'bg-green-50 border-green-200 text-green-700',
    description: 'GPT-4, GPT-3.5 등 OpenAI 모델',
    websiteUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Claude',
    displayName: 'Claude (Anthropic)',
    keyField: 'claude_api_key',
    icon: '🧠',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    description: 'Claude 3.5 Sonnet, Opus 등',
    websiteUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    displayName: 'Kimi',
    keyField: 'kimi_api_key',
    icon: '🌙',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    description: 'Moonshot AI의 Kimi 모델',
    websiteUrl: 'https://platform.moonshot.cn/',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Gemini (Google)',
    keyField: 'gemini_api_key',
    icon: '✨',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    description: 'Google Gemini Pro, Ultra 등',
    websiteUrl: 'https://makersuite.google.com/app/apikey',
  },
];

interface AIProviderManagerProps {
  isRsupportUser: boolean;
}

export default function AIProviderManager({ isRsupportUser }: AIProviderManagerProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    claude: false,
    kimi: false,
    gemini: false,
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    setLoading(true);
    try {
      const endpoint = isRsupportUser ? '/api/organization/settings' : '/api/settings/openai-key';
      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();

        if (isRsupportUser && data.settings) {
          // Organization settings
          setApiKeys({
            openai: !!data.settings.openai_api_key,
            claude: !!data.settings.claude_api_key,
            kimi: !!data.settings.kimi_api_key,
            gemini: !!data.settings.gemini_api_key,
          });
        } else if (!isRsupportUser) {
          // Individual user settings - for now only OpenAI is supported
          setApiKeys(prev => ({
            ...prev,
            openai: data.has_key || false,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = (provider: AIProvider) => {
    if (selectedProvider === provider) {
      setSelectedProvider(null);
      setApiKeyInput('');
    } else {
      setSelectedProvider(provider);
      setApiKeyInput('');
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) {
      showError('API 키를 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const config = AI_PROVIDERS.find(p => p.id === selectedProvider);
      let response;

      if (isRsupportUser) {
        // Organization settings
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [config!.keyField]: apiKeyInput.trim() }),
        });
      } else {
        // Individual user settings - currently only supports OpenAI
        if (selectedProvider !== 'openai') {
          showError('개인 계정은 현재 OpenAI만 지원합니다.');
          return;
        }
        response = await fetch('/api/settings/openai-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKeyInput.trim() }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'API 키 저장 실패');
      }

      setApiKeys(prev => ({ ...prev, [selectedProvider]: true }));
      setApiKeyInput('');
      setSelectedProvider(null);
      showSuccess(`${config!.displayName} API 키가 저장되었습니다.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'API 키 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedProvider) return;

    const config = AI_PROVIDERS.find(p => p.id === selectedProvider);
    if (!showConfirm(`${config!.displayName} API 키를 삭제하시겠습니까?${isRsupportUser ? ' (조직 전체에 영향을 미칩니다)' : ''}`)) {
      return;
    }

    setSaving(true);

    try {
      let response;

      if (isRsupportUser) {
        // Organization settings
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [config!.keyField]: null }),
        });
      } else {
        // Individual user settings
        if (selectedProvider !== 'openai') {
          showError('개인 계정은 현재 OpenAI만 지원합니다.');
          return;
        }
        response = await fetch('/api/settings/openai-key', {
          method: 'DELETE',
        });
      }

      if (!response.ok) {
        throw new Error('API 키 삭제 실패');
      }

      setApiKeys(prev => ({ ...prev, [selectedProvider]: false }));
      setSelectedProvider(null);
      showSuccess(`${config!.displayName} API 키가 삭제되었습니다.`);
    } catch (error) {
      console.error('Error deleting API key:', error);
      showError('API 키 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardTitle>AI 제공사 API 키 관리</CardTitle>
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>
        AI 제공사 API 키 관리
        {isRsupportUser && (
          <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
            조직 전체 공유
          </span>
        )}
      </CardTitle>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {isRsupportUser
          ? '조직에서 사용할 AI 제공사의 API 키를 관리합니다. 여러 AI 서비스를 등록하여 필요에 따라 선택할 수 있습니다.'
          : 'AI 자동 번역 기능을 사용하려면 AI 제공사의 API 키가 필요합니다.'
        }
      </p>

      {/* AI Provider Badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        {AI_PROVIDERS.map((provider) => {
          const isConfigured = apiKeys[provider.id];
          const isSelected = selectedProvider === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => handleSelectProvider(provider.id)}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? provider.color + ' ring-2 ring-offset-2'
                  : isConfigured
                  ? provider.color + ' hover:shadow-md'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{provider.icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">{provider.displayName}</div>
                  <div className="text-xs opacity-75">
                    {isConfigured ? '설정됨 ✓' : '미설정'}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Provider Details */}
      {selectedProvider && (
        <div className="border-t pt-6 animate-in fade-in duration-200">
          {(() => {
            const config = AI_PROVIDERS.find(p => p.id === selectedProvider)!;
            const isConfigured = apiKeys[selectedProvider];

            return (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-4xl">{config.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{config.displayName}</h3>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </div>
                  <Badge variant={isConfigured ? 'success' : 'warning'}>
                    {isConfigured ? '설정됨' : '미설정'}
                  </Badge>
                </div>

                <Input
                  label={isConfigured ? '새 API 키 (변경시에만 입력)' : 'API 키 *'}
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={`${config.name} API 키를 입력하세요`}
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveKey}
                    loading={saving}
                    disabled={!apiKeyInput.trim()}
                  >
                    {isConfigured ? 'API 키 변경' : 'API 키 저장'}
                  </Button>
                  {isConfigured && (
                    <Button
                      variant="danger"
                      onClick={handleDeleteKey}
                      loading={saving}
                    >
                      API 키 삭제
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedProvider(null);
                      setApiKeyInput('');
                    }}
                  >
                    취소
                  </Button>
                </div>

                <p className="text-xs text-gray-400">
                  API 키는 암호화되어 안전하게 저장됩니다.{' '}
                  <a
                    href={config.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {config.name} 대시보드
                  </a>
                  에서 API 키를 발급받을 수 있습니다.
                </p>
              </div>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
