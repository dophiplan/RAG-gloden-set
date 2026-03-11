/**
 * Request Adapter
 * 
 * Deprecated API 요청을 Unified API 요청으로 변환
 * 하위 호환성을 위해 deprecated 필드명도 지원
 */

export interface AdaptedRequest {
  ids: string[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Translation Bulk Update 요청 변환
 * - translation_ids → ids
 * - 평탄화된 구조 → data 객체
 */
export function adaptTranslationUpdateRequest(body: Record<string, unknown>): AdaptedRequest {
  const adapted: AdaptedRequest = {
    // 하위 호환성: translation_ids 또는 ids 지원
    ids: (body.ids as string[]) || (body.translation_ids as string[]) || [],
  };

  // data 객체가 있으면 사용, 없으면 평탄화된 구조에서 추출
  if (body.data && typeof body.data === 'object') {
    adapted.data = body.data as Record<string, unknown>;
  } else {
    // 평탄화된 구조에서 ids 관련 필드를 제외하고 data로 구성
    const { ids, translation_ids, ...dataFields } = body;
    if (Object.keys(dataFields).length > 0) {
      adapted.data = dataFields;
    }
  }

  // 기타 필드 복사
  Object.keys(body).forEach(key => {
    if (!['ids', 'translation_ids', 'data'].includes(key)) {
      adapted[key] = body[key];
    }
  });

  return adapted;
}

/**
 * Glossary Bulk Update 요청 변환
 * - glossary_ids → items[].id
 * - 평탄화된 구조 → items[] 배열
 */
export function adaptGlossaryUpdateRequest(body: Record<string, unknown>): { items: Array<Record<string, unknown>> } {
  // 이미 items 배열 형식이면 그대로 반환
  if (body.items && Array.isArray(body.items)) {
    return { items: body.items as Array<Record<string, unknown>> };
  }

  // glossary_ids를 items 배열로 변환
  const ids = (body.glossary_ids as string[]) || (body.ids as string[]) || [];
  
  // 나머지 필드를 각 item에 분배
  const { glossary_ids, ids: _, ...fields } = body;
  
  const items = ids.map(id => ({
    id,
    ...fields,
  }));

  return { items };
}

/**
 * Translation Bulk Delete 요청 변환
 * - translation_ids → ids
 */
export function adaptTranslationDeleteRequest(body: Record<string, unknown>): { ids: string[]; permanent?: boolean } {
  return {
    ids: (body.ids as string[]) || (body.translation_ids as string[]) || [],
    permanent: body.permanent as boolean || false,
  };
}

/**
 * Glossary Bulk Delete 요청 변환
 * - glossary_ids → ids
 */
export function adaptGlossaryDeleteRequest(body: Record<string, unknown>): { ids: string[] } {
  return {
    ids: (body.ids as string[]) || (body.glossary_ids as string[]) || [],
  };
}

/**
 * Admin Users Bulk Update 요청 변환
 * - user_ids → ids
 * - 평탄화된 필드 → data 객체
 */
export function adaptAdminUsersUpdateRequest(body: Record<string, unknown>): { ids: string[]; data: Record<string, unknown> } {
  const ids = (body.ids as string[]) || (body.user_ids as string[]) || [];
  
  // data 객체 추출
  let data: Record<string, unknown>;
  if (body.data && typeof body.data === 'object') {
    data = body.data as Record<string, unknown>;
  } else {
    const { ids, user_ids, ...fields } = body;
    data = fields;
  }

  return { ids, data };
}

/**
 * Admin Users Bulk Delete 요청 변환
 * - user_ids → ids
 */
export function adaptAdminUsersDeleteRequest(body: Record<string, unknown>): { ids: string[] } {
  return {
    ids: (body.ids as string[]) || (body.user_ids as string[]) || [],
  };
}

/**
 * 메인 어댑터 함수
 */
export function adaptRequest(
  type: string,
  action: string,
  body: Record<string, unknown>
): AdaptedRequest | { items: Array<Record<string, unknown>> } | { ids: string[]; data?: Record<string, unknown> } {
  const key = `${type}:${action}`;

  switch (key) {
    case 'translations:update':
      return adaptTranslationUpdateRequest(body);
    case 'translations:delete':
      return adaptTranslationDeleteRequest(body);
    case 'translations:products':
    case 'translations:status':
      return adaptTranslationUpdateRequest(body);
    case 'glossary:update':
      return adaptGlossaryUpdateRequest(body);
    case 'glossary:delete':
      return adaptGlossaryDeleteRequest(body);
    case 'admin-users:update':
      return adaptAdminUsersUpdateRequest(body);
    case 'admin-users:delete':
      return adaptAdminUsersDeleteRequest(body);
    default:
      // 기본적으로 ids 필드만 처리
      return {
        ids: (body.ids as string[]) || [],
        ...body,
      };
  }
}
