import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationCrudService } from '@/services';
import { translationCreateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { successResponse, serverError, badRequest } from '@/lib/api/middleware';

/**
 * Handler for POST /api/translations
 * Creates a new translation with optional translations and product links
 */
export async function handleCreateTranslation(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user directly from Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Translation POST] Direct auth check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
    });

    if (authError || !user || !user.id) {
      console.error('[Translation POST] Authentication failed:', {
        authError: authError?.message,
        hasUser: !!user,
        userId: user?.id,
      });

      return NextResponse.json(
        {
          error: '인증이 필요합니다.',
          details: process.env.NODE_ENV === 'development' ? {
            authError: authError?.message,
            hasUser: !!user,
            userId: user?.id,
          } : undefined,
        },
        { status: 401 }
      );
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
      return badRequest(validation.error);
    }

    const body = validation.data;

    // Get user profile for audit log
    const { data: userProfile } = await supabase
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

    // Call service to create translation
    const service = new TranslationCrudService(supabase);
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

    return successResponse(translation, 201);
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

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '번역을 생성하는데 실패했습니다.',
            details: errorMessage,
            stack: errorStack,
          }
        },
        { status: 500 }
      );
    }

    return serverError('번역을 생성하는데 실패했습니다.');
  }
}
