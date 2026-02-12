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
    icon: '',
    color: 'bg-green-50 border-green-200 text-green-700',
    description: 'GPT-4, GPT-3.5',
    websiteUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Claude',
    displayName: 'Claude',
    keyField: 'claude_api_key',
    icon: '',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    description: 'Claude 3.5 Sonnet',
    websiteUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    displayName: 'Kimi',
    keyField: 'kimi_api_key',
    icon: '',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    description: 'Moonshot AI',
    websiteUrl: 'https://platform.moonshot.cn/',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Gemini',
    keyField: 'gemini_api_key',
    icon: '',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    description: 'Google Gemini',
    websiteUrl: 'https://makersuite.google.com/app/apikey',
  },
];

interface AIProviderManagerProps {
  isRsupportUser: boolean;
  isAdmin?: boolean;
}

export default function AIProviderManager({ isRsupportUser, isAdmin = false }: AIProviderManagerProps) {
  const canUseAllProviders = isRsupportUser || isAdmin;
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    claude: false,
    kimi: false,
    gemini: false,
  });
  const [providerOrder, setProviderOrder] = useState<AIProvider[]>(['openai', 'claude', 'kimi', 'gemini']);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    setLoading(true);
    try {
      const endpoint = canUseAllProviders ? '/api/organization/settings' : '/api/settings/openai-key';
      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();

        if (canUseAllProviders && data.settings) {
          // Organization settings
          setApiKeys({
            openai: !!data.settings.openai_api_key,
            claude: !!data.settings.claude_api_key,
            kimi: !!data.settings.kimi_api_key,
            gemini: !!data.settings.gemini_api_key,
          });

          // Load provider order from settings
          if (data.settings.settings?.ai_provider_order) {
            setProviderOrder(data.settings.settings.ai_provider_order);
          }
        } else if (!canUseAllProviders) {
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
      setIsEditing(false);
    } else {
      setSelectedProvider(provider);
      setApiKeyInput('');
      setIsEditing(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...providerOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setProviderOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);

    // Save order to backend
    if (canUseAllProviders) {
      try {
        await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: { ai_provider_order: providerOrder }
          }),
        });
      } catch (error) {
        console.error('Error saving provider order:', error);
      }
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

      if (canUseAllProviders) {
        // Organization settings or admin user
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [config!.keyField]: apiKeyInput.trim() }),
        });
      } else {
        // Individual user settings - currently only supports OpenAI
        if (selectedProvider !== 'openai') {
          showError('일반 사용자는 현재 OpenAI만 지원합니다.');
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
      setIsEditing(false);
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
    if (!showConfirm(`${config!.displayName} API 키를 삭제하시겠습니까?${canUseAllProviders ? ' (조직 전체에 영향을 미칩니다)' : ''}`)) {
      return;
    }

    setSaving(true);

    try {
      let response;

      if (canUseAllProviders) {
        // Organization settings or admin user
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [config!.keyField]: null }),
        });
      } else {
        // Individual user settings
        if (selectedProvider !== 'openai') {
          showError('일반 사용자는 현재 OpenAI만 지원합니다.');
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
      setIsEditing(false);
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

  const selectedProviderConfig = selectedProvider
    ? AI_PROVIDERS.find(p => p.id === selectedProvider)
    : null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>
          {selectedProviderConfig
            ? `${selectedProviderConfig.displayName} API 키 설정`
            : 'AI 제공사 API 키'}
        </CardTitle>
        {selectedProvider && (
          <button
            onClick={() => {
              setSelectedProvider(null);
              setApiKeyInput('');
              setIsEditing(false);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Show only selected or all cards */}
      {selectedProvider ? (
        // Selected card - edit mode
        <div>
          {AI_PROVIDERS.filter(p => p.id === selectedProvider).map((provider) => {
            const isConfigured = apiKeys[provider.id];
            const showMasked = isConfigured && !isEditing;

            return (
              <div key={provider.id}>
                <div>
                  <div className="flex gap-2">
                    <input
                      type={showMasked ? 'text' : 'password'}
                      value={showMasked ? 'sk-•••••••••••••••••••••••' : apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="API 키를 입력하세요"
                      disabled={showMasked}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:bg-gray-50 disabled:text-gray-700"
                    />
                    {showMasked ? (
                      <>
                        <Button
                          onClick={() => setIsEditing(true)}
                        >
                          변경
                        </Button>
                        <Button
                          variant="danger"
                          onClick={handleDeleteKey}
                          loading={saving}
                        >
                          삭제
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleSaveKey}
                        loading={saving}
                        disabled={!apiKeyInput.trim()}
                      >
                        저장
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // All cards - grid view (same style as other management sections)
        <div>
          <p className="text-xs text-gray-500 mb-2">
            드래그하여 사용 우선순위를 변경할 수 있습니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {providerOrder.map((providerId, index) => {
              const provider = AI_PROVIDERS.find(p => p.id === providerId);
              if (!provider) return null;

              const isConfigured = apiKeys[provider.id];
              const isDragging = draggedIndex === index;

              return (
                <div
                  key={provider.id}
                  draggable={canUseAllProviders}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all ${
                    canUseAllProviders ? 'cursor-move' : 'cursor-pointer'
                  } ${isDragging ? 'opacity-50' : ''}`}
                  onClick={() => handleSelectProvider(provider.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                      <p className="font-semibold text-gray-900">{provider.displayName}</p>
                    </div>
                    <Badge variant={isConfigured ? 'success' : 'warning'}>
                      {isConfigured ? '✓' : '○'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
