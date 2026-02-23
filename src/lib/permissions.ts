import { User, UserRole, LanguageCode } from '@/types';

/**
 * Check if user has a specific role
 */
export function hasRole(user: User | null, role: UserRole): boolean {
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  if (!user || !user.roles) return false;
  return roles.some(role => user.roles.includes(role));
}

/**
 * Check if user is a master (admin)
 */
export function isMaster(user: User | null): boolean {
  return hasRole(user, 'master');
}

/**
 * Check if user can manage other users (1st Master or Master account level)
 * Falls back to checking roles if account_level is not set
 */
export function canManageUsers(user: User | null): boolean {
  if (!user) return false;

  // Check account_level if available
  if (user.account_level) {
    return user.account_level === '1st_master' || user.account_level === 'master';
  }

  // Fallback: check roles for backwards compatibility
  return isMaster(user) || hasRole(user, '1st_master');
}

/**
 * Check if user can translate for a specific language
 */
export function canTranslate(user: User | null, languageCode: LanguageCode): boolean {
  if (!user) return false;
  if (isMaster(user)) return true;

  const roleMap: Record<string, UserRole> = {
    'ja': 'translator_ja',
    'zh-CN': 'translator_zh',
    'zh-TW': 'translator_zh',
    'en': 'translator_en',
  };

  const requiredRole = roleMap[languageCode];
  return requiredRole ? hasRole(user, requiredRole) : false;
}

/**
 * Check if user can review translations for a specific language
 */
export function canReview(user: User | null, languageCode: LanguageCode): boolean {
  if (!user) return false;
  if (isMaster(user)) return true;

  const roleMap: Record<string, UserRole> = {
    'ja': 'reviewer_ja',
    'zh-CN': 'reviewer_zh',
    'zh-TW': 'reviewer_zh',
    'en': 'reviewer_en',
  };

  const requiredRole = roleMap[languageCode];
  return requiredRole ? hasRole(user, requiredRole) : false;
}

/**
 * Check if user can deploy translations
 */
export function canDeploy(user: User | null): boolean {
  if (!user) return false;
  return isMaster(user) || hasRole(user, 'deployer');
}

/**
 * Check if user can request translations
 */
export function canRequestTranslation(user: User | null): boolean {
  if (!user) return false;
  return isMaster(user) || hasRole(user, 'requester');
}

/**
 * Check if user can access settings (Master only)
 */
export function canAccessSettings(user: User | null): boolean {
  return isMaster(user);
}

/**
 * Check if user can manage accounts (Master only)
 */
export function canManageAccounts(user: User | null): boolean {
  return isMaster(user);
}

/**
 * Check if user can send emails
 */
export function canSendEmail(user: User | null): boolean {
  if (!user) return false;
  // Any authenticated user with relevant roles can send emails
  return isMaster(user) ||
         hasAnyRole(user, ['requester', 'pm', 'pl', 'deployer']);
}
