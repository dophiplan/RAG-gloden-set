// @deprecated Use useProducts() hook instead - products are now fetched from DB
// Keeping for backward compatibility during migration
export const PRODUCTS = {
  RC: 'RC',
  RV: 'RV',
  RM: 'RM',
  Rfice: 'rfice',
  repoto: 'repoto',
  RVS: 'RVS',
  mobizen: '모비즌',
  agent: '에이전트',
  marketing: '마케팅',
} as const;

// @deprecated Use string type instead - products are dynamic
export type ProductCode = string;

export interface Product {
  id: string;
  code: ProductCode;
  name: string;
  description: string | null;
  display_order: number;
  default_languages: string[] | null;
  created_at: string;
}

// @deprecated Use usePlatforms() hook instead - platforms are now fetched from DB
// Keeping for backward compatibility during migration
export const WORK_SCOPE_OPTIONS = [
  'Win',
  'Mac',
  'Front',
  'Back',
  'Android',
  'iOS',
  'flutter',
  '기타',
] as const;

// User work scope options (broader scope for user settings)
export const USER_WORK_SCOPE_OPTIONS = [
  '기획',
  '디자인',
  'PM',
  'PL',
  'Win',
  'Mac',
  'Front',
  'Back',
  'Android',
  'iOS',
  'flutter',
  '번역',
  '검수',
] as const;
