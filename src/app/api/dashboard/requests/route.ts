import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiInternalError } from '@/lib/api/response';
import type { TranslationStatus, PriorityLevel } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all data in parallel for better performance
    const [
      productsResult,
      groupedTranslationsResult,
      individualTranslationsResult
    ] = await Promise.all([
      // Fetch products for name lookup
      supabase.from('products').select('code, name'),
      
      // Fetch translations with request_id (grouped requests)
      supabase
        .from('translations')
        .select(`
          id,
          request_id,
          status,
          priority,
          scope,
          version,
          created_at,
          user_id,
          users(id, name, email),
          translation_products(product_code, version)
        `)
        .not('request_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
      
      // Fetch individual translations
      supabase
        .from('translations')
        .select(`
          id,
          status,
          priority,
          scope,
          version,
          created_at,
          user_id,
          users(id, name, email),
          translation_products(product_code, version)
        `)
        .is('request_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    const productsData = productsResult.data;
    const groupedTranslations = groupedTranslationsResult.data;
    const groupedError = groupedTranslationsResult.error;
    const individualTranslations = individualTranslationsResult.data;

    // Build products map for lookup
    const productsMap = (productsData || []).reduce((acc: Record<string, string>, p: { code: string; name: string }) => {
      acc[p.code] = p.name;
      return acc;
    }, {} as Record<string, string>);

    if (groupedError) {
      console.error('Dashboard requests API grouped fetch error:', groupedError);
      console.error('Error details:', JSON.stringify(groupedError, null, 2));
      return apiInternalError(`그룹화된 요청 조회 중 오류가 발생했습니다: ${groupedError.message || groupedError.code || 'Unknown error'}`);
    }

    // Step 2: Group translations by request_id
    const requestMap = new Map<string, any[]>();
    (groupedTranslations || []).forEach(trans => {
      if (!requestMap.has(trans.request_id)) {
        requestMap.set(trans.request_id, []);
      }
      requestMap.get(trans.request_id)!.push(trans);
    });

    // Step 3: Get all translation IDs for audit log query
    const allTranslationIds = [
      ...(groupedTranslations || []).map(t => t.id),
      ...(individualTranslations || []).map(t => t.id)
    ];

    // Step 4: Fetch deployed timestamps
    const { data: deployedLogs } = allTranslationIds.length > 0
      ? await supabase
          .from('translation_audit_logs')
          .select('translation_id, created_at')
          .in('translation_id', allTranslationIds)
          .eq('action', 'update')
          .eq('field_name', 'status')
          .eq('new_value', 'deployed')
          .order('created_at', { ascending: true })
      : { data: [] };

    const deployedMap = new Map<string, string>();
    (deployedLogs || []).forEach((log: { translation_id: string; created_at: string }) => {
      if (!deployedMap.has(log.translation_id)) {
        deployedMap.set(log.translation_id, log.created_at);
      }
    });

    // Step 5: Format grouped requests
    const groupedRequests = Array.from(requestMap.entries()).map(([requestId, translations]) => {
      const rawUser = translations[0].users;
      const user = Array.isArray(rawUser)
        ? rawUser[0]
        : rawUser;

      // Handle missing user (fallback)
      const safeUser = user || { id: translations[0].user_id || 'unknown', name: 'Unknown', email: '' };

      // Determine request-level status
      const statuses = (translations || []).map((t: { status: string }) => t.status);
      let requestStatus: TranslationStatus;
      if (statuses.includes('pending')) requestStatus = 'pending';
      else if (statuses.every((s: string) => s === 'deployed')) requestStatus = 'deployed';
      else if (statuses.every((s: string) => s === 'reviewed' || s === 'deployed')) requestStatus = 'reviewed';
      else requestStatus = 'in_progress';

      // Get highest priority
      const priorityOrder: Record<string, number> = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const priority = translations.reduce((highest: string, t: { priority: string }) =>
        (priorityOrder[t.priority] || 0) > (priorityOrder[highest] || 0) ? t.priority : highest
      , translations[0].priority) as PriorityLevel;

      // Get earliest deployed_at if all deployed
      const deployedAt = requestStatus === 'deployed'
        ? translations
            .map((t: { id: string }) => deployedMap.get(t.id))
            .filter(Boolean)
            .sort()[0] || null
        : null;

      // Get unique products
      const allProducts = (translations || []).flatMap((t: { translation_products?: { product_code: string; version?: string }[] }) => t.translation_products || []);
      const uniqueProducts = Array.from(
        new Map((allProducts || []).map((p: { product_code: string }) => [p.product_code, p])).values()
      );

      return {
        id: requestId,
        translation_ids: (translations || []).map((t: { id: string }) => t.id),
        translation_count: (translations || []).length,
        status: requestStatus,
        priority,
        request_date: translations[0].created_at,
        deployed_at: deployedAt,
        requester: {
          id: safeUser.id,
          name: safeUser.name,
          email: safeUser.email,
        },
        products: (uniqueProducts || []).map((tp: { product_code: string; version?: string }) => ({
          code: tp.product_code,
          name: productsMap[tp.product_code] || tp.product_code,
          version: translations[0].version || tp.version || null,
          category: translations[0].scope || null,
        })),
      };
    });

    // Step 6: Format individual translations (backwards compatibility)
    const individualRequests = (individualTranslations || []).map((translation: {
      id: string;
      status: TranslationStatus;
      priority: PriorityLevel;
      scope: string | null;
      version: string | null;
      created_at: string;
      users: { id: string; name: string; email: string } | { id: string; name: string; email: string }[] | null;
      translation_products: { product_code: string; version?: string }[];
    }) => {
      const rawUser = translation.users;
      const user = Array.isArray(rawUser)
        ? rawUser[0]
        : rawUser;
      
      // Handle missing user (fallback)
      const safeUser = user || { id: translation.id, name: 'Unknown', email: '' };

      return {
        id: translation.id,
        translation_ids: [translation.id],
        translation_count: 1,
        status: translation.status,
        priority: translation.priority,
        request_date: translation.created_at,
        deployed_at: deployedMap.get(translation.id) || null,
        requester: {
          id: safeUser.id,
          name: safeUser.name,
          email: safeUser.email,
        },
        products: (translation.translation_products || []).map((tp: { product_code: string; version?: string }) => ({
          code: tp.product_code,
          name: productsMap[tp.product_code] || tp.product_code,
          version: translation.version || tp.version || null,
          category: translation.scope || null,
        })),
      };
    });

    // Step 7: Combine and sort all requests
    const allRequests = [...groupedRequests, ...individualRequests];

    const priorityOrder: Record<string, number> = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };

    allRequests.sort((a, b) => {
      // Incomplete first
      const aCompleted = !!a.deployed_at;
      const bCompleted = !!b.deployed_at;
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

      // By priority
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // By date
      if (!aCompleted) {
        return new Date(b.request_date).getTime() - new Date(a.request_date).getTime();
      }
      const aDate = a.deployed_at ? new Date(a.deployed_at).getTime() : 0;
      const bDate = b.deployed_at ? new Date(b.deployed_at).getTime() : 0;
      return bDate - aDate;
    });

    return apiSuccess({ requests: allRequests.slice(0, 10) });
  } catch (error) {
    console.error('Dashboard requests API error:', error);
    return apiInternalError(
      '요청 목록 조회 중 오류가 발생했습니다.',
      error instanceof Error ? error.message : undefined
    );
  }
}
