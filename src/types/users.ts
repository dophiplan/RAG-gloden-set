import type { ProductCode } from './products';

// User role labels for display
export const USER_ROLE_LABELS: Record<string, string> = {
  '1st_master': '최고 관리자',
  master: '마스터',
  translator_ja: '일본어 번역',
  translator_zh: '중국어 번역',
  translator_en: '영어 번역',
  reviewer_ja: '일본어 검수',
  reviewer_zh: '중국어 검수',
  reviewer_en: '영어 검수',
  requester: '요청',
  deployer: '반영',
  pm: 'PM',
  pl: 'PL',
};

export type UserRole =
  | '1st_master'
  | 'master'
  | 'translator_ja' | 'translator_zh' | 'translator_en'
  | 'reviewer_ja' | 'reviewer_zh' | 'reviewer_en'
  | 'requester'
  | 'deployer'
  | 'pm'
  | 'pl';

// Special protected user email
export const FIRST_MASTER_EMAIL = 'nhkim@rsupport.com';

export type AccountLevel = '1st_master' | 'master' | 'manager' | 'user';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  // Account level (permission tier)
  account_level: AccountLevel;
  // New fields from Phase 1
  roles: UserRole[];
  work_products: ProductCode[];
  work_scope: string[];
  work_languages: string[];
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

// User settings
export interface UserSettings {
  id: string;
  user_id: string;
  openai_api_key: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
