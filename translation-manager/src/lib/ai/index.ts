export {
  translateWithProvider,
  translateWithOpenAI,
  translateWithClaude,
  translateWithKimi,
  translateWithGemini,
  validateApiKeyWithTestCall,
} from './providers';

export type {
  AIProvider,
  TranslateInput,
  TranslationResult,
  GlossaryTerm,
  TranslationMemoryEntry,
  CorrectionEntry,
} from './providers';
