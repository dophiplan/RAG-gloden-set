'use client';

import { useState, useEffect } from 'react';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showSuccess, showError } from '@/lib/notifications';
import { apiGet, apiPatch } from '@/lib/api-utils';

export type AIProvider = 'openai' | 'claude' | 'kimi' | 'gemini';

interface AIProviderConfig {
  id: AIProvider;
  name: string;
  displayName: string;
  keyField: string;
  color: string;
  description: string;
  websiteUrl: string;
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'kimi',
    name: 'Kimi',
    displayName: 'Kimi',
    keyField: 'kimi_api_key',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    description: 'Moonshot AI',
    websiteUrl: 'https://platform.moonshot.cn/',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI',
    keyField: 'openai_api_key',
    color: 'bg-green-50 border-green-200 text-green-700',
    description: 'GPT-4, GPT-3.5',
    websiteUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Claude',
    displayName: 'Claude',
    keyField: 'claude_api_key',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    description: 'Claude 3.5 Sonnet',
    websiteUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    displayName: 'Gemini',
    keyField: 'gemini_api_key',
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
  
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    claude: false,
    kimi: false,
    gemini: false,
  });
  
  const [providerOrder, setProviderOrder] = useState<AIProvider[]>(['kimi', 'openai', 'claude', 'gemini']);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<AIProvider | null>(null);
  const [dragOverItem, setDragOverItem] = useState<AIProvider | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const result = await apiGet<{ settings?: { openai_api_key?: string; claude_api_key?: string; kimi_api_key?: string; gemini_api_key?: string; ai_provider_order?: string[] } }>('/api/organization/settings');
      // API returns { settings: {...} }
      const settings = result.settings;
      
      if (settings) {
        setApiKeys({
          openai: !!settings.openai_api_key,
          claude: !!settings.claude_api_key,
          kimi: !!settings.kimi_api_key,
          gemini: !!settings.gemini_api_key,
        });
        
        if (settings.ai_provider_order) {
          setProviderOrder(settings.ai_provider_order as AIProvider[]);
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) {
      showError('API 키를 입력해주세요.');
      return;
    }

    // Validate key format (provider-specific)
    const keyPrefix = apiKeyInput.trim().substring(0, 10);
    const isValidKey = 
      keyPrefix.startsWith('sk-') ||           // OpenAI, Kimi, etc
      keyPrefix.startsWith('sk-ant') ||        // Anthropic
      keyPrefix.startsWith('AIza');            // Google (Gemini)
    
    if (!isValidKey) {
      showError('유효하지 않은 API 키 형식입니다. (예: sk-..., sk-ant-..., AIza...)');
      return;
    }

    setSaving(true);

    try {
      const config = AI_PROVIDERS.find(p => p.id === selectedProvider)!;
      
      await apiPatch('/api/organization/settings', { [config.keyField]: apiKeyInput.trim() });

      setApiKeys(prev => ({ ...prev, [selectedProvider]: true }));
      setApiKeyInput('');
      setSelectedProvider(null);
      showSuccess(`${config.displayName} API 키가 저장되었습니다.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'API 키 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (provider: AIProvider) => {
    const config = AI_PROVIDERS.find(p => p.id === provider)!;
    
    if (!confirm(`${config.displayName} API 키를 삭제하시겠습니까?`)) {
      return;
    }

    setSaving(true);

    try {
      await apiPatch('/api/organization/settings', { [config.keyField]: null });

      setApiKeys(prev => ({ ...prev, [provider]: false }));
      showSuccess(`${config.displayName} API 키가 삭제되었습니다.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'API 키 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, providerId: AIProvider) => {
    setDraggedItem(providerId);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image transparent
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragOver = (e: React.DragEvent, providerId: AIProvider) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem && draggedItem !== providerId) {
      setDragOverItem(providerId);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetProviderId: AIProvider) => {
    e.preventDefault();
    setDragOverItem(null);
    
    if (!draggedItem || draggedItem === targetProviderId) return;

    // Reorder the list
    const newOrder = [...providerOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetProviderId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      setProviderOrder(newOrder);
      // Auto-save the new order
      saveProviderOrder(newOrder);
    }

    setDraggedItem(null);
  };

  const saveProviderOrder = async (newOrder: AIProvider[]) => {
    setIsSavingOrder(true);
    try {
      await apiPatch('/api/organization/settings', { 
        settings: { ai_provider_order: newOrder }
      });

      showSuccess('AI 제공사 우선순위가 저장되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '우선순위 저장에 실패했습니다.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardTitle>API 키 관리</CardTitle>
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>API 키 관리</CardTitle>
      
      {selectedProvider ? (
        // Edit mode
        <div className="mt-4">
          {AI_PROVIDERS.filter(p => p.id === selectedProvider).map(provider => (
            <div key={provider.id}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{provider.displayName} API 키 설정</h3>
                <button
                  onClick={() => { setSelectedProvider(null); setApiKeyInput(''); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={`${provider.displayName} API 키를 입력하세요`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
                <Button
                  onClick={handleSaveKey}
                  loading={saving}
                  disabled={!apiKeyInput.trim()}
                >
                  저장
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                <a href={provider.websiteUrl} target="_blank" className="text-blue-500 hover:underline">
                  {provider.displayName} API 키 발급받기 →
                </a>
              </p>
            </div>
          ))}
        </div>
      ) : (
        // List mode
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              드래그하여 사용 우선순위를 변경할 수 있습니다.
            </p>
            {isSavingOrder && (
              <span className="text-xs text-blue-500">저장 중...</span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {providerOrder.map((providerId, index) => {
              const provider = AI_PROVIDERS.find(p => p.id === providerId)!;
              const isConfigured = apiKeys[provider.id];
              const isDragOver = dragOverItem === providerId;

              return (
                <div
                  key={provider.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, providerId)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, providerId)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, providerId)}
                  className={`
                    p-4 border rounded-lg transition-all cursor-move select-none
                    ${isConfigured ? provider.color : 'bg-gray-100 border-gray-200'}
                    ${isConfigured ? 'bg-opacity-30' : ''}
                    ${!isConfigured ? 'grayscale' : ''}
                    ${isDragOver ? 'ring-2 ring-blue-400 scale-105' : 'hover:shadow-md'}
                    ${draggedItem === providerId ? 'opacity-50' : 'opacity-100'}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isConfigured ? 'text-gray-500' : 'text-gray-400'}`}>#{index + 1}</span>
                      <span className={`font-semibold ${isConfigured ? '' : 'text-gray-500'}`}>{provider.displayName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                      <Badge variant={isConfigured ? 'success' : 'warning'}>
                        {isConfigured ? '✓' : '○'}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className={`text-xs mb-3 ${isConfigured ? 'text-gray-600' : 'text-gray-400'}`}>{provider.description}</p>
                  
                  {isConfigured ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedProvider(provider.id)}
                      >
                        변경
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteKey(provider.id)}
                        disabled={saving}
                      >
                        삭제
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedProvider(provider.id)}
                    >
                      API 키 등록
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
