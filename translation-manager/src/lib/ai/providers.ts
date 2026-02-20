import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AIProvider = 'openai' | 'claude' | 'kimi' | 'gemini';

export interface TranslationMemoryEntry {
  source_text: string;
  translated_text: string;
  language_code: string;
}

export interface CorrectionEntry {
  original_text: string;
  corrected_text: string;
  source_text: string;
  language_code: string;
}

export interface GlossaryTerm {
  id?: string;
  term: string;
  translation: string;
  language_code: string;
  context?: string;
}

export interface TranslateInput {
  sourceText: string;
  context: string | null;
  targetLanguages: string[];
  glossaryTerms?: GlossaryTerm[];
  translationMemory?: TranslationMemoryEntry[];
  corrections?: CorrectionEntry[];
  apiKey: string;
}

export interface TranslationResult {
  languageCode: string;
  translatedText: string;
}

// API Timeout 설정 (30초)
const API_TIMEOUT = 30000;

// Language code to name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ko: 'Korean',
};

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

function buildSystemPrompt(
  glossaryTerms: GlossaryTerm[],
  translationMemory: TranslationMemoryEntry[],
  corrections: CorrectionEntry[],
  targetLanguages: string[]
): string {
  // Build glossary context by language
  const glossaryByLanguage: Record<string, string[]> = {};
  glossaryTerms.forEach((term) => {
    if (!glossaryByLanguage[term.language_code]) {
      glossaryByLanguage[term.language_code] = [];
    }
    let glossaryEntry = `"${term.term}" → "${term.translation}"`;
    if (term.context) {
      glossaryEntry += `\n  Context: ${term.context}`;
    }
    glossaryByLanguage[term.language_code].push(glossaryEntry);
  });

  // Build translation memory context by language
  const memoryByLanguage: Record<string, string[]> = {};
  translationMemory.forEach((entry) => {
    if (!memoryByLanguage[entry.language_code]) {
      memoryByLanguage[entry.language_code] = [];
    }
    memoryByLanguage[entry.language_code].push(
      `"${entry.source_text}" → "${entry.translated_text}"`
    );
  });

  // Build corrections context by language
  const correctionsByLanguage: Record<string, string[]> = {};
  corrections.forEach((entry) => {
    if (!correctionsByLanguage[entry.language_code]) {
      correctionsByLanguage[entry.language_code] = [];
    }
    correctionsByLanguage[entry.language_code].push(
      `When "${entry.source_text}" was translated as "${entry.original_text}", it was corrected to "${entry.corrected_text}"`
    );
  });

  return `You are a professional translator specializing in Korean to multiple languages translation.

RULES:
1. Translate the given Korean text accurately while maintaining natural expression in each target language.
2. Preserve the original tone and intent.
3. Use the provided glossary terms consistently - these are mandatory translations that MUST be used.
4. Pay special attention to the context information provided with glossary terms.
5. Learn from previous corrections and apply similar patterns.
6. Consider the translation memory for consistency with existing translations.

${Object.entries(glossaryByLanguage).length > 0 ? `GLOSSARY (you MUST follow these translations):
${Object.entries(glossaryByLanguage)
  .map(([lang, terms]) => `[${lang}]\n${terms.join('\n\n')}`)
  .join('\n\n')}

Important: The glossary terms above are mandatory. When translating, always use these exact translations when the Korean terms appear in the source text.` : ''}

${Object.entries(memoryByLanguage).length > 0 ? `TRANSLATION MEMORY (reference for consistency):
${Object.entries(memoryByLanguage)
  .map(([lang, entries]) => `[${lang}]\n${entries.slice(0, 10).join('\n')}`)
  .join('\n\n')}` : ''}

${Object.entries(correctionsByLanguage).length > 0 ? `PREVIOUS CORRECTIONS (learn from these patterns):
${Object.entries(correctionsByLanguage)
  .map(([lang, entries]) => `[${lang}]\n${entries.slice(0, 5).join('\n')}`)
  .join('\n\n')}` : ''}

Respond ONLY in JSON format:
{
  "translations": [
    {"languageCode": "en", "translatedText": "..."},
    {"languageCode": "ja", "translatedText": "..."}
  ]
}`;
}

// Secure API key validation (check format only, don't expose key)
function validateApiKey(provider: string, apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: `${provider} API 키가 없습니다.` };
  }
  
  // Check key format based on provider
  switch (provider) {
    case 'openai':
    case 'kimi':
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: `${provider} API 키는 "sk-"로 시작해야 합니다.` };
      }
      break;
    case 'claude':
      if (!apiKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Claude API 키는 "sk-ant-"로 시작해야 합니다.' };
      }
      break;
    case 'gemini':
      // Gemini keys don't have a standard prefix
      if (apiKey.length < 10) {
        return { valid: false, error: 'Gemini API 키 형식이 올바르지 않습니다.' };
      }
      break;
  }
  
  return { valid: true };
}

// Generic API call with timeout and retry
async function callWithTimeout<T>(
  fn: () => Promise<T>,
  timeout: number = API_TIMEOUT,
  retries: number = 2
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), timeout);
      });
      
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on authentication errors
      if (lastError.message.includes('401') || lastError.message.includes('Authentication')) {
        throw lastError;
      }
      
      // Wait before retry (exponential backoff)
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
}

// OpenAI Provider
export async function translateWithOpenAI(input: TranslateInput): Promise<TranslationResult[]> {
  const validation = validateApiKey('OpenAI', input.apiKey);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const openai = new OpenAI({ 
    apiKey: input.apiKey,
    timeout: API_TIMEOUT,
    maxRetries: 2,
  });

  const systemPrompt = buildSystemPrompt(
    input.glossaryTerms || [],
    input.translationMemory || [],
    input.corrections || [],
    input.targetLanguages
  );

  const targetLangNames = input.targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(', ');

  const userPrompt = `Translate the following Korean text to: ${targetLangNames}

Korean text: "${input.sourceText}"
${input.context ? `Context/Usage: ${input.context}` : ''}

Please provide translations for ALL specified languages.`;

  const response = await callWithTimeout(() =>
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content);

  if (!result.translations || !Array.isArray(result.translations)) {
    throw new Error('Invalid response format from OpenAI');
  }

  return result.translations
    .filter(
      (t: { languageCode?: string; translatedText?: string }) =>
        t.languageCode &&
        t.translatedText &&
        input.targetLanguages.includes(t.languageCode)
    )
    .map((t: { languageCode: string; translatedText: string }) => ({
      languageCode: t.languageCode,
      translatedText: t.translatedText,
    }));
}

// Claude (Anthropic) Provider
export async function translateWithClaude(input: TranslateInput): Promise<TranslationResult[]> {
  const validation = validateApiKey('Claude', input.apiKey);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const anthropic = new Anthropic({ 
    apiKey: input.apiKey,
    timeout: API_TIMEOUT,
  });

  const systemPrompt = buildSystemPrompt(
    input.glossaryTerms || [],
    input.translationMemory || [],
    input.corrections || [],
    input.targetLanguages
  );

  const targetLangNames = input.targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(', ');

  const userPrompt = `Translate the following Korean text to: ${targetLangNames}

Korean text: "${input.sourceText}"
${input.context ? `Context/Usage: ${input.context}` : ''}

Please provide translations for ALL specified languages.

Respond ONLY in JSON format:
{
  "translations": [
    {"languageCode": "en", "translatedText": "..."},
    {"languageCode": "ja", "translatedText": "..."}
  ]
}`;

  const response = await callWithTimeout(() =>
    anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.3,
    })
  );

  const content = response.content[0]?.type === 'text' ? response.content[0].text : null;
  if (!content) {
    throw new Error('No response from Claude');
  }

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const result = JSON.parse(jsonMatch[0]);

  if (!result.translations || !Array.isArray(result.translations)) {
    throw new Error('Invalid response format from Claude');
  }

  return result.translations
    .filter(
      (t: { languageCode?: string; translatedText?: string }) =>
        t.languageCode &&
        t.translatedText &&
        input.targetLanguages.includes(t.languageCode)
    )
    .map((t: { languageCode: string; translatedText: string }) => ({
      languageCode: t.languageCode,
      translatedText: t.translatedText,
    }));
}

// Kimi (Moonshot) Provider - OpenAI compatible
export async function translateWithKimi(input: TranslateInput): Promise<TranslationResult[]> {
  const validation = validateApiKey('Kimi', input.apiKey);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const kimi = new OpenAI({
    apiKey: input.apiKey,
    baseURL: 'https://api.moonshot.ai/v1',
    timeout: API_TIMEOUT,
    maxRetries: 2,
  });

  const systemPrompt = buildSystemPrompt(
    input.glossaryTerms || [],
    input.translationMemory || [],
    input.corrections || [],
    input.targetLanguages
  );

  const targetLangNames = input.targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(', ');

  const userPrompt = `Translate the following Korean text to: ${targetLangNames}

Korean text: "${input.sourceText}"
${input.context ? `Context/Usage: ${input.context}` : ''}

Please provide translations for ALL specified languages.`;

  try {
    const response = await callWithTimeout(() =>
      kimi.chat.completions.create({
        model: 'kimi-k2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 1,
        response_format: { type: 'json_object' },
      })
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Kimi');
    }

    const result = JSON.parse(content);

    if (!result.translations || !Array.isArray(result.translations)) {
      throw new Error('Invalid response format from Kimi');
    }

    return result.translations
      .filter(
        (t: { languageCode?: string; translatedText?: string }) =>
          t.languageCode &&
          t.translatedText &&
          input.targetLanguages.includes(t.languageCode)
      )
      .map((t: { languageCode: string; translatedText: string }) => ({
        languageCode: t.languageCode,
        translatedText: t.translatedText,
      }));
  } catch (error: any) {
    // Sanitize error message to avoid exposing API key
    if (error.message?.includes('401') || error.message?.includes('Authentication')) {
      throw new Error('Kimi API 인증 실패: API 키를 확인해주세요.');
    }
    if (error.message?.includes('timeout')) {
      throw new Error('Kimi API 요청 시간 초과: 나중에 다시 시도해주세요.');
    }
    throw new Error(`Kimi 번역 실패: ${error.message || '알 수 없는 오류'}`);
  }
}

// Gemini (Google) Provider
export async function translateWithGemini(input: TranslateInput): Promise<TranslationResult[]> {
  const validation = validateApiKey('Gemini', input.apiKey);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemPrompt = buildSystemPrompt(
    input.glossaryTerms || [],
    input.translationMemory || [],
    input.corrections || [],
    input.targetLanguages
  );

  const targetLangNames = input.targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(', ');

  const prompt = `${systemPrompt}

---

Translate the following Korean text to: ${targetLangNames}

Korean text: "${input.sourceText}"
${input.context ? `Context/Usage: ${input.context}` : ''}

Please provide translations for ALL specified languages.

Respond ONLY in JSON format:
{
  "translations": [
    {"languageCode": "en", "translatedText": "..."},
    {"languageCode": "ja", "translatedText": "..."}
  ]
}`;

  try {
    const result = await callWithTimeout(() =>
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      })
    );

    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('No response from Gemini');
    }

    const parsed = JSON.parse(text);

    if (!parsed.translations || !Array.isArray(parsed.translations)) {
      throw new Error('Invalid response format from Gemini');
    }

    return parsed.translations
      .filter(
        (t: { languageCode?: string; translatedText?: string }) =>
          t.languageCode &&
          t.translatedText &&
          input.targetLanguages.includes(t.languageCode)
      )
      .map((t: { languageCode: string; translatedText: string }) => ({
        languageCode: t.languageCode,
        translatedText: t.translatedText,
      }));
  } catch (error: any) {
    // Sanitize error message
    if (error.message?.includes('401') || error.message?.includes('API key not valid')) {
      throw new Error('Gemini API 인증 실패: API 키를 확인해주세요.');
    }
    throw new Error(`Gemini 번역 실패: ${error.message || '알 수 없는 오류'}`);
  }
}

// Main translation function with provider selection
export async function translateWithProvider(
  provider: AIProvider,
  input: TranslateInput
): Promise<TranslationResult[]> {
  switch (provider) {
    case 'openai':
      return translateWithOpenAI(input);
    case 'claude':
      return translateWithClaude(input);
    case 'kimi':
      return translateWithKimi(input);
    case 'gemini':
      return translateWithGemini(input);
    default:
      throw new Error(`지원하지 않는 제공사: ${provider}`);
  }
}

// Validate API key by making a test call (for settings page)
export async function validateApiKeyWithTestCall(
  provider: AIProvider,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  // First check format
  const formatCheck = validateApiKey(provider, apiKey);
  if (!formatCheck.valid) {
    return formatCheck;
  }

  // Then make a test call
  try {
    await translateWithProvider(provider, {
      sourceText: '테스트',
      context: null,
      targetLanguages: ['en'],
      apiKey,
    });
    return { valid: true };
  } catch (error: any) {
    // Return sanitized error
    if (error.message?.includes('401') || error.message?.includes('인증')) {
      return { valid: false, error: 'API 키가 유효하지 않습니다.' };
    }
    if (error.message?.includes('timeout') || error.message?.includes('시간 초과')) {
      return { valid: false, error: 'API 서버 응답 시간 초과. 나중에 다시 시도해주세요.' };
    }
    return { valid: false, error: 'API 키 검증 실패: ' + error.message };
  }
}
