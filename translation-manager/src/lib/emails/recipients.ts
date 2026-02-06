/**
 * Email Recipients Determination Logic
 * Automatically determines TO and CC recipients based on email template type
 */

import { EmailTemplateType, User, UserRole } from '@/types';
import { SupabaseClient } from '@supabase/supabase-js';

export interface EmailRecipients {
  to: string[];
  cc: string[];
}

/**
 * Determine email recipients based on template type and translations
 */
export async function determineRecipients(
  supabase: SupabaseClient,
  templateType: EmailTemplateType,
  translationIds: string[],
  languageCodes?: string[]
): Promise<EmailRecipients> {

  switch (templateType) {
    case 'translation_request':
      return await getTranslationRequestRecipients(supabase, languageCodes);

    case 'review_request':
      return await getReviewRequestRecipients(supabase, languageCodes);

    case 'translation_complete':
      return await getTranslationCompleteRecipients(supabase);

    case 'deployment_complete':
      return await getDeploymentCompleteRecipients(supabase);

    default:
      return { to: [], cc: [] };
  }
}

/**
 * Get recipients for translation request
 * TO: Translators for the requested languages
 * CC: PM, PL
 */
async function getTranslationRequestRecipients(
  supabase: SupabaseClient,
  languageCodes?: string[]
): Promise<EmailRecipients> {
  const to: string[] = [];
  const cc: string[] = [];

  // Get translators for requested languages
  if (languageCodes && languageCodes.length > 0) {
    const requiredRoles: UserRole[] = [];

    languageCodes.forEach(lang => {
      if (lang === 'ja') requiredRoles.push('translator_ja');
      if (lang === 'zh-CN' || lang === 'zh-TW') requiredRoles.push('translator_zh');
      if (lang === 'en') requiredRoles.push('translator_en');
    });

    if (requiredRoles.length > 0) {
      const { data: translators } = await supabase
        .from('users')
        .select('email')
        .filter('roles', 'cs', `{${requiredRoles.join(',')}}`);

      if (translators) {
        translators.forEach(user => {
          if (user.email && !to.includes(user.email)) {
            to.push(user.email);
          }
        });
      }
    }
  }

  // Get PM/PL for CC
  const { data: managers } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{pm},roles.cs.{pl}');

  if (managers) {
    managers.forEach(user => {
      if (user.email && !cc.includes(user.email)) {
        cc.push(user.email);
      }
    });
  }

  return { to, cc };
}

/**
 * Get recipients for review request
 * TO: Reviewers for the requested language
 * CC: PM, PL, original translators
 */
async function getReviewRequestRecipients(
  supabase: SupabaseClient,
  languageCodes?: string[]
): Promise<EmailRecipients> {
  const to: string[] = [];
  const cc: string[] = [];

  // Get reviewers for requested language
  if (languageCodes && languageCodes.length > 0) {
    const requiredRoles: UserRole[] = [];

    languageCodes.forEach(lang => {
      if (lang === 'ja') requiredRoles.push('reviewer_ja');
      if (lang === 'zh-CN' || lang === 'zh-TW') requiredRoles.push('reviewer_zh');
      if (lang === 'en') requiredRoles.push('reviewer_en');
    });

    if (requiredRoles.length > 0) {
      const { data: reviewers } = await supabase
        .from('users')
        .select('email')
        .filter('roles', 'cs', `{${requiredRoles.join(',')}}`);

      if (reviewers) {
        reviewers.forEach(user => {
          if (user.email && !to.includes(user.email)) {
            to.push(user.email);
          }
        });
      }
    }
  }

  // Get PM/PL and translators for CC
  const { data: managers } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{pm},roles.cs.{pl},roles.cs.{translator_ja},roles.cs.{translator_zh},roles.cs.{translator_en}');

  if (managers) {
    managers.forEach(user => {
      if (user.email && !cc.includes(user.email) && !to.includes(user.email)) {
        cc.push(user.email);
      }
    });
  }

  return { to, cc };
}

/**
 * Get recipients for translation complete notification
 * TO: Requesters, PM, PL
 * CC: Translators who worked on it
 */
async function getTranslationCompleteRecipients(
  supabase: SupabaseClient
): Promise<EmailRecipients> {
  const to: string[] = [];
  const cc: string[] = [];

  // Get requesters and managers
  const { data: requesters } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{requester},roles.cs.{pm},roles.cs.{pl}');

  if (requesters) {
    requesters.forEach(user => {
      if (user.email && !to.includes(user.email)) {
        to.push(user.email);
      }
    });
  }

  // Get translators for CC
  const { data: translators } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{translator_ja},roles.cs.{translator_zh},roles.cs.{translator_en}');

  if (translators) {
    translators.forEach(user => {
      if (user.email && !cc.includes(user.email) && !to.includes(user.email)) {
        cc.push(user.email);
      }
    });
  }

  return { to, cc };
}

/**
 * Get recipients for deployment complete notification
 * TO: PM, PL, deployers
 * CC: Translators, requesters
 */
async function getDeploymentCompleteRecipients(
  supabase: SupabaseClient
): Promise<EmailRecipients> {
  const to: string[] = [];
  const cc: string[] = [];

  // Get PM/PL/deployers for TO
  const { data: managers } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{pm},roles.cs.{pl},roles.cs.{deployer}');

  if (managers) {
    managers.forEach(user => {
      if (user.email && !to.includes(user.email)) {
        to.push(user.email);
      }
    });
  }

  // Get translators and requesters for CC
  const { data: others } = await supabase
    .from('users')
    .select('email')
    .or('roles.cs.{translator_ja},roles.cs.{translator_zh},roles.cs.{translator_en},roles.cs.{requester}');

  if (others) {
    others.forEach(user => {
      if (user.email && !cc.includes(user.email) && !to.includes(user.email)) {
        cc.push(user.email);
      }
    });
  }

  return { to, cc };
}
