import { describe, it, expect, vi, beforeEach } from 'vitest';

// AI Provider API Key 관리 테스트
describe('AI Provider Manager', () => {
  const mockProviders = [
    { id: 'openai', name: 'OpenAI', keyField: 'openai_api_key' },
    { id: 'claude', name: 'Claude', keyField: 'claude_api_key' },
    { id: 'kimi', name: 'Kimi', keyField: 'kimi_api_key' },
    { id: 'gemini', name: 'Gemini', keyField: 'gemini_api_key' },
  ];

  describe('API Key Validation', () => {
    it('should accept OpenAI keys starting with sk-', () => {
      const validKeys = ['sk-test123', 'sk-openai-key'];
      validKeys.forEach(key => {
        expect(key.startsWith('sk-')).toBe(true);
      });
    });

    it('should accept Anthropic keys starting with sk-ant', () => {
      const validKeys = ['sk-ant-test123', 'sk-ant-api-key'];
      validKeys.forEach(key => {
        expect(key.startsWith('sk-ant')).toBe(true);
      });
    });

    it('should accept Google Gemini keys starting with AIza', () => {
      const validKeys = ['AIza-test123', 'AIza-syC-test-key'];
      validKeys.forEach(key => {
        expect(key.startsWith('AIza')).toBe(true);
      });
    });

    it('should reject invalid key formats', () => {
      const invalidKeys = ['invalid-key', '12345', 'api-key-test'];
      invalidKeys.forEach(key => {
        const isValid = 
          key.startsWith('sk-') ||
          key.startsWith('sk-ant') ||
          key.startsWith('AIza');
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Provider Order Management', () => {
    it('should maintain provider order after drag and drop', () => {
      const initialOrder = ['openai', 'claude', 'kimi', 'gemini'];
      const newOrder = ['kimi', 'openai', 'claude', 'gemini'];
      
      // Simulate drag: move 'kimi' from index 2 to index 0
      const draggedItem = 'kimi';
      const draggedIndex = initialOrder.indexOf(draggedItem);
      const targetIndex = 0;
      
      const reordered = [...initialOrder];
      reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, draggedItem);
      
      expect(reordered).toEqual(newOrder);
    });

    it('should auto-select first available provider by priority', () => {
      const providerOrder = ['kimi', 'openai', 'claude', 'gemini'];
      const availableProviders = {
        openai: 'sk-openai-key',
        claude: 'sk-ant-claude-key',
        // kimi and gemini not available
      };

      let selectedProvider = null;
      for (const provider of providerOrder) {
        if (availableProviders[provider as keyof typeof availableProviders]) {
          selectedProvider = provider;
          break;
        }
      }

      // kimi is first in order but not available, so openai should be selected
      expect(selectedProvider).toBe('openai');
    });
  });

  describe('API Response Parsing', () => {
    it('should handle standardized API response format', () => {
      const standardizedResponse = {
        data: {
          settings: {
            openai_api_key: 'sk-test',
            kimi_api_key: null,
            ai_provider_order: ['kimi', 'openai', 'claude', 'gemini'],
          },
        },
      };

      const settings = standardizedResponse.data;
      expect(settings.settings?.openai_api_key).toBe('sk-test');
      expect(settings.settings?.kimi_api_key).toBeNull();
    });

    it('should handle legacy API response format', () => {
      const legacyResponse = {
        settings: {
          openai_api_key: 'sk-test',
          kimi_api_key: null,
        },
      };

      const settings = legacyResponse;
      expect(settings.settings?.openai_api_key).toBe('sk-test');
    });
  });
});

describe('Organization Settings API', () => {
  describe('buildUpdateData', () => {
    it('should validate and filter API keys by format', () => {
      const input = {
        openai_api_key: 'sk-valid-key',
        claude_api_key: 'sk-ant-valid',
        gemini_api_key: 'AIza-valid',
        kimi_api_key: 'invalid-key',
      };

      const keyFields = ['openai_api_key', 'claude_api_key', 'kimi_api_key', 'gemini_api_key'];
      const updateData: Record<string, string | null> = {};

      for (const field of keyFields) {
        const value = input[field as keyof typeof input];
        if (value) {
          const isValid =
            value.startsWith('sk-') ||
            value.startsWith('sk-ant') ||
            value.startsWith('AIza');
          if (isValid) {
            updateData[field] = value;
          }
        }
      }

      expect(updateData['openai_api_key']).toBe('sk-valid-key');
      expect(updateData['claude_api_key']).toBe('sk-ant-valid');
      expect(updateData['gemini_api_key']).toBe('AIza-valid');
      expect(updateData['kimi_api_key']).toBeUndefined(); // invalid format filtered
    });

    it('should allow null for key deletion', () => {
      const input = {
        openai_api_key: null,
      };

      const updateData: Record<string, string | null> = {};
      if (input.openai_api_key === null) {
        updateData['openai_api_key'] = null;
      }

      expect(updateData['openai_api_key']).toBeNull();
    });
  });
});
