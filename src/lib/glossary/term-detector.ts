import { createClient } from '@/lib/supabase/server';
import { LanguageCode, ProductCode } from '@/types';

export interface TermSuggestion {
  term: string;              // 감지된 용어 (한국어)
  translation: string;       // 번역
  language_code: string;     // 언어
  source_text: string;       // 원문 문맥
  frequency: number;         // 등장 횟수
  confidence: number;        // 신뢰도 (0-1)
  sample_contexts: string[]; // 사용 예시들
}

/**
 * Corrections에서 반복되는 패턴 분석
 * 짧은 번역(단어/구문)이 여러 다른 문맥에서 반복 사용되는 경우 제안
 */
export async function detectTermsFromCorrections(
  languageCode?: string,
  limit: number = 50
): Promise<TermSuggestion[]> {
  const supabase = await createClient();

  // 최근 30일 이내의 corrections 가져오기
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from('translation_corrections')
    .select('original_text, corrected_text, source_text, language_code')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  if (languageCode) {
    query = query.eq('language_code', languageCode);
  }

  const { data: corrections, error } = await query;

  if (error || !(corrections || []).length) {
    console.error('Error fetching corrections:', error);
    return [];
  }

  // 짧은 번역 단위로 그룹화 (단어나 짧은 구문만 - 3단어 이하)
  const termMap = new Map<string, {
    koreanTerms: Map<string, number>;  // 한국어 원문에서 추출한 용어들
    contexts: Set<string>;
    frequency: number;
  }>();

  (corrections || []).forEach((correction) => {
    // corrected_text에서 짧은 번역만 추출 (전체 문장이 아닌 단어/구문)
    const translationTerms = extractShortTranslations(correction.corrected_text);
    const koreanTerms = extractKoreanTerms(correction.source_text);

    (translationTerms || []).forEach((translationTerm) => {
      const key = `${translationTerm}|${correction.language_code}`;

      if (!termMap.has(key)) {
        termMap.set(key, {
          koreanTerms: new Map(),
          contexts: new Set(),
          frequency: 0,
        });
      }

      const entry = termMap.get(key)!;
      entry.frequency += 1;
      entry.contexts.add(correction.source_text);

      // 한국어 원문에서 추출한 용어들과 연결
      (koreanTerms || []).forEach((koreanTerm) => {
        const count = entry.koreanTerms.get(koreanTerm) || 0;
        entry.koreanTerms.set(koreanTerm, count + 1);
      });
    });
  });

  const suggestions: TermSuggestion[] = [];

  // 3회 이상 반복되고, 다양한 문맥에서 나타나는 용어만 제안
  termMap.forEach((value, key) => {
    const [translation, langCode] = key.split('|');

    if (value.frequency >= 3 && value.contexts.size >= 2) {
      // 가장 많이 함께 나타난 한국어 용어 찾기
      let mostCommonKoreanTerm = '';
      let maxCount = 0;

      (value.koreanTerms || new Map()).forEach((count, koreanTerm) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonKoreanTerm = koreanTerm;
        }
      });

      // 신뢰도: 특정 한국어 용어와 함께 나타난 비율
      const confidence = maxCount / value.frequency;

      // 신뢰도가 너무 낮으면 제외 (50% 이상)
      if (confidence >= 0.5 && mostCommonKoreanTerm) {
        suggestions.push({
          term: mostCommonKoreanTerm,
          translation: translation,
          language_code: langCode,
          source_text: Array.from(value.contexts)[0],
          frequency: value.frequency,
          confidence,
          sample_contexts: Array.from(value.contexts).slice(0, 5),
        });
      }
    }
  });

  // 신뢰도와 빈도를 고려해서 정렬
  suggestions.sort((a, b) => {
    const scoreA = a.confidence * Math.log(a.frequency + 1);
    const scoreB = b.confidence * Math.log(b.frequency + 1);
    return scoreB - scoreA;
  });

  return suggestions.slice(0, limit);
}

/**
 * 번역 텍스트에서 짧은 단어/구문만 추출 (3단어 이하)
 */
function extractShortTranslations(text: string): string[] {
  if (!text || text.length > 100) return []; // 너무 긴 문장은 제외

  const terms: string[] = [];
  const words = text.trim().split(/\s+/);

  // 1단어
  (words || []).forEach((word) => {
    const cleaned = word.replace(/[^\w가-힣]/g, '');
    if (cleaned.length >= 2 && cleaned.length <= 20) {
      terms.push(cleaned);
    }
  });

  // 2단어 조합
  for (let i = 0; i < (words || []).length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`.trim();
    if (phrase.length <= 30) {
      terms.push(phrase);
    }
  }

  // 3단어 조합
  for (let i = 0; i < (words || []).length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.trim();
    if (phrase.length <= 40) {
      terms.push(phrase);
    }
  }

  // 전체가 짧으면 그것도 추가
  if (text.trim().length <= 50) {
    terms.push(text.trim());
  }

  return [...new Set(terms)]; // 중복 제거
}

/**
 * 한국어 텍스트에서 용어 추출
 */
function extractKoreanTerms(text: string): string[] {
  if (!text) return [];

  const terms: string[] = [];

  // 한국어 단어 추출 (공백으로 구분)
  const words = text.split(/\s+/);

  words.forEach((word) => {
    const cleaned = word.replace(/[^\w가-힣]/g, '');
    if (cleaned.length >= 2 && cleaned.length <= 20) {
      terms.push(cleaned);
    }
  });

  // 2단어 조합
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`.trim();
    if (phrase.length >= 2 && phrase.length <= 30) {
      terms.push(phrase);
    }
  }

  return [...new Set(terms)]; // 중복 제거
}

/**
 * 최근 번역에서 반복되는 용어 분석
 * translation_results에서 짧은 번역이 반복 사용되는 경우 제안
 */
export async function detectTermsFromTranslations(
  productCode?: string,
  limit: number = 50
): Promise<TermSuggestion[]> {
  const supabase = await createClient();

  // 최근 60일 이내의 번역 가져오기
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // 먼저 translations를 가져오기
  let translationsQuery = supabase
    .from('translations')
    .select(`
      id,
      source_text,
      created_at,
      translation_products (product_code)
    `)
    .gte('created_at', sixtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: translations, error: transError } = await translationsQuery;

  if (transError || !(translations || []).length) {
    console.error('Error fetching translations:', transError);
    return [];
  }

  // 제품 필터링
  const filteredTranslations = productCode
    ? (translations || []).filter((t) =>
        t.translation_products?.some((p) => p.product_code === productCode)
      )
    : translations;

  if ((filteredTranslations || []).length === 0) {
    return [];
  }

  // translation_results 가져오기
  const translationIds = (filteredTranslations || []).map((t) => t.id);

  const { data: results, error: resultsError } = await supabase
    .from('translation_results')
    .select('translation_id, language_code, translated_text')
    .in('translation_id', translationIds);

  if (resultsError || !(results || []).length) {
    console.error('Error fetching translation results:', resultsError);
    return [];
  }

  // translations와 results 매핑
  const translationMap = new Map(
    (filteredTranslations || []).map((t) => [t.id, t])
  );

  // 짧은 번역 단위로 그룹화
  const termMap = new Map<string, {
    koreanTerms: Map<string, number>;
    contexts: Set<string>;
    frequency: number;
  }>();

  (results || []).forEach((result) => {
    const translation = translationMap.get(result.translation_id);
    if (!translation) return;

    const sourceText = translation.source_text;
    const translatedText = result.translated_text;
    const langCode = result.language_code;

    // 짧은 번역만 추출
    const translationTerms = extractShortTranslations(translatedText);
    const koreanTerms = extractKoreanTerms(sourceText);

    (translationTerms || []).forEach((translationTerm) => {
      const key = `${translationTerm}|${langCode}`;

      if (!termMap.has(key)) {
        termMap.set(key, {
          koreanTerms: new Map(),
          contexts: new Set(),
          frequency: 0,
        });
      }

      const entry = termMap.get(key)!;
      entry.frequency += 1;
      entry.contexts.add(sourceText);

      (koreanTerms || []).forEach((koreanTerm) => {
        const count = entry.koreanTerms.get(koreanTerm) || 0;
        entry.koreanTerms.set(koreanTerm, count + 1);
      });
    });
  });

  const suggestions: TermSuggestion[] = [];

  termMap.forEach((value, key) => {
    const [translation, langCode] = key.split('|');

    if (value.frequency >= 3 && value.contexts.size >= 2) {
      let mostCommonKoreanTerm = '';
      let maxCount = 0;

      value.koreanTerms.forEach((count, koreanTerm) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonKoreanTerm = koreanTerm;
        }
      });

      const confidence = maxCount / value.frequency;

      if (confidence >= 0.5 && mostCommonKoreanTerm) {
        suggestions.push({
          term: mostCommonKoreanTerm,
          translation: translation,
          language_code: langCode,
          source_text: Array.from(value.contexts)[0],
          frequency: value.frequency,
          confidence,
          sample_contexts: Array.from(value.contexts).slice(0, 5),
        });
      }
    }
  });

  suggestions.sort((a, b) => {
    const scoreA = a.confidence * Math.log(a.frequency + 1);
    const scoreB = b.confidence * Math.log(b.frequency + 1);
    return scoreB - scoreA;
  });

  return suggestions.slice(0, limit);
}

/**
 * 기존 용어집과 중복 제거
 */
async function filterExistingTerms(
  suggestions: TermSuggestion[]
): Promise<TermSuggestion[]> {
  if ((suggestions || []).length === 0) return [];

  const supabase = await createClient();

  const { data: existingTerms, error } = await supabase
    .from('glossary')
    .select('term, language_code');

  if (error || !existingTerms) {
    console.error('Error fetching existing terms:', error);
    return suggestions;
  }

  const existingSet = new Set(
    (existingTerms || []).map((t) => `${t.term}|${t.language_code}`)
  );

  return (suggestions || []).filter(
    (s) => !existingSet.has(`${s.term}|${s.language_code}`)
  );
}

/**
 * 두 가지 소스를 결합하여 최종 제안
 */
export async function suggestGlossaryTerms(
  languageCode?: LanguageCode,
  productCode?: ProductCode,
  limit: number = 20
): Promise<TermSuggestion[]> {
  try {
    // 두 소스에서 제안 가져오기
    const [correctionsTerms, translationsTerms] = await Promise.all([
      detectTermsFromCorrections(languageCode, limit * 2).catch((err) => {
        console.error('Error in detectTermsFromCorrections:', err);
        return [];
      }),
      detectTermsFromTranslations(productCode, limit * 2).catch((err) => {
        console.error('Error in detectTermsFromTranslations:', err);
        return [];
      }),
    ]);

    // 중복 제거 및 병합
    const termMap = new Map<string, TermSuggestion>();

    [...correctionsTerms, ...translationsTerms].forEach((suggestion) => {
      const key = `${suggestion.term}|${suggestion.language_code}`;

      if (!termMap.has(key)) {
        termMap.set(key, suggestion);
      } else {
        // 이미 있으면 빈도와 신뢰도 업데이트
        const existing = termMap.get(key)!;
        existing.frequency += suggestion.frequency;
        existing.confidence = Math.max(existing.confidence, suggestion.confidence);

        // sample_contexts 병합 (중복 제거)
        const allContexts = [...existing.sample_contexts, ...suggestion.sample_contexts];
        existing.sample_contexts = [...new Set(allContexts)].slice(0, 5);
      }
    });

    let combined = Array.from(termMap.values());

    // 기존 용어집과 중복 제거
    combined = await filterExistingTerms(combined);

    // 최종 정렬 및 제한
    combined.sort((a, b) => {
      const scoreA = a.confidence * Math.log(a.frequency + 1);
      const scoreB = b.confidence * Math.log(b.frequency + 1);
      return scoreB - scoreA;
    });

    return combined.slice(0, limit);
  } catch (error) {
    console.error('Error in suggestGlossaryTerms:', error);
    return [];
  }
}
