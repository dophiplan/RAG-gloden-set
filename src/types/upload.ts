import type { LanguageCode, ProductCode } from './index';

/**
 * 추출된 텍스트 아이템 타입
 * 용어집 매칭 및 중복 번역 체크 정보 포함
 */
export interface ExtractedTextItem {
  id: number;
  text: string;
  selected: boolean;
  glossaryMatch?: {
    exists: boolean;
    translations?: Record<string, string>;
    termId?: string;
  };
  duplicateCheck?: {
    status: 'new' | 'exact_match' | 'similar';
    existingTranslation?: string;
    completedAt?: string;
    similarity?: number;
  };
}

/**
 * 용어집 추가 모달 Props
 */
export interface GlossaryAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  productCode: ProductCode | '';
  languageCodes: LanguageCode[];
  onSuccess?: () => void;
}

/**
 * 추출된 텍스트 아이템 컴포넌트 Props
 */
export interface ExtractedTextItemProps {
  item: ExtractedTextItem;
  onToggle: (id: number) => void;
  onGlossaryAdd: (text: string) => void;
  onCopy: (text: string) => void;
}

/**
 * 업로드 페이지 벌크 액션 바 Props
 */
export interface UploadBulkActionBarProps {
  selectedCount: number;
  selectedItems: ExtractedTextItem[];
  onClearSelection: () => void;
  onBulkGlossaryAdd: () => void;
  isProcessing?: boolean;
}

/**
 * 중복 번역 체크 요청
 */
export interface DuplicateCheckRequest {
  texts: string[];
  product_code?: ProductCode;
}

/**
 * 중복 번역 체크 응답
 */
export interface DuplicateCheckResponse {
  results: Array<{
    text: string;
    status: 'new' | 'exact_match' | 'similar';
    existingTranslation?: string;
    completedAt?: string;
    similarity?: number;
  }>;
}

/**
 * 용어집 생성 입력
 */
export interface GlossaryCreateRequest {
  sourceText: string;
  translation?: string;
  context?: string;
  product_code?: ProductCode | null;
  product_codes?: ProductCode[];
  targetLanguages?: LanguageCode[];
}

/**
 * 용어집 생성 응답
 */
export interface GlossaryCreateResponse {
  terms: Array<{
    id: string;
    term: string;
    language_code: LanguageCode;
  }>;
}
