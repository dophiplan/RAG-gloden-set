import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationCrudService } from '@/services';
import { translationCreateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { apiSuccess, apiInternalError, apiBadRequest, apiUnauthorized } from '@/lib/api/response';
import { getAuthUser } from '@/lib/api-auth';

/**
 * Handler for POST /api/translations
 * Creates a new translation with optional translations and product links
 */
export async function handleCreateTranslation(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user (with bypass support for development)
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    console.log('[Translation POST] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError,
      bypassed: !!adminClient,
    });

    if (authError || !user || !user.id) {
      console.error('[Translation POST] Authentication failed:', {
        authError,
        hasUser: !!user,
        userId: user?.id,
      });

      return apiUnauthorized();
    }

    // Check rate limit for API creation
    const rateLimitResult = await enforceRateLimit(user.id, 'api_create');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse and validate request body
    const rawBody = await request.json();
    console.log('[Translation POST] Received body:', JSON.stringify(rawBody, null, 2));

    const validation = validateAndSanitize(translationCreateSchema, rawBody);

    if (!validation.success) {
      console.error('[Translation POST] Validation failed:', validation.error);
      console.error('[Translation POST] Raw body was:', rawBody);
      return apiBadRequest(validation.error);
    }

    const body = validation.data;

    // Get user profile for audit log (use adminClient if available for bypass mode)
    const dbClient = adminClient || supabase;
    const { data: userProfile } = await dbClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Sanitize text inputs
    const sanitizedSourceText = sanitizeText(body.source_text);
    const sanitizedContext = body.context ? sanitizeText(body.context) : undefined;
    const sanitizedVersion = body.version ? sanitizeText(body.version) : undefined;

    // Prepare translations array
    const translations = body.translations?.map(t => ({
      languageCode: t.language_code,
      translatedText: sanitizeText(t.translated_text),
    }));

    // Call service to create translation (use adminClient if available for bypass mode)
    const service = new TranslationCrudService(dbClient);
    const translation = await service.createTranslation(
      {
        sourceText: sanitizedSourceText,
        context: sanitizedContext,
        version: sanitizedVersion,
        productCode: body.product_code as any,
        productCodes: body.product_codes as any,
        scope: body.scope as any,
        priority: body.priority,
        completionDate: body.completion_date,
        userId: user.id,
        translations,
      },
      {
        name: userProfile?.name,
        email: userProfile?.email || user.email || '',
      }
    );

    return apiSuccess(translation);
  } catch (error) {
    console.error('Error creating translation:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Development: Return detailed error
    if (process.env.NODE_ENV === 'development') {
      let errorMessage = 'Unknown error';
      let errorStack = '';

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack?.split('\n').slice(0, 3).join(' | ') || '';
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }

      return apiInternalError(
        '번역을 생성하는데 실패했습니다.',
        { errorMessage, errorStack }
      );
    }

    return apiInternalError('번역을 생성하는데 실패했습니다.');
  }
}
