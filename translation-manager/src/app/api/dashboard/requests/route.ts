import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRODUCTS } from '@/lib/constants';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch recent translations with user and product information (fetch 100 for client-side sorting)
    const { data: translations, error: translationsError } = await supabase
      .from('translations')
      .select(`
        id,
        status,
        priority,
        scope,
        created_at,
        user_id,
        users!inner(
          id,
          name,
          email
        ),
        translation_products(
          product_code,
          version
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (translationsError) {
      console.error('Error fetching translations:', translationsError);
      return NextResponse.json(
        { error: 'Failed to fetch translations' },
        { status: 500 }
      );
    }

    if (!translations || translations.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Get translation IDs for audit log query
    const translationIds = translations.map(t => t.id);

    // Fetch deployed timestamps from audit logs
    const { data: deployedLogs, error: logsError } = await supabase
      .from('translation_audit_logs')
      .select('translation_id, created_at')
      .in('translation_id', translationIds)
      .eq('action', 'update')
      .eq('field_name', 'status')
      .eq('new_value', 'deployed')
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('Error fetching audit logs:', logsError);
      // Continue without deployed dates rather than failing
    }

    // Create a map of translation_id to deployed_at timestamp (first occurrence)
    const deployedMap = new Map<string, string>();
    if (deployedLogs) {
      for (const log of deployedLogs) {
        if (!deployedMap.has(log.translation_id)) {
          deployedMap.set(log.translation_id, log.created_at);
        }
      }
    }

    // Format the response
    const requests = translations.map(translation => {
      // Supabase returns users as array when using !inner, take first element
      const user = Array.isArray(translation.users) ? translation.users[0] : translation.users;

      return {
        id: translation.id,
        status: translation.status,
        priority: translation.priority,
        request_date: translation.created_at,
        deployed_at: deployedMap.get(translation.id) || null,
        requester: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        products: (translation.translation_products || []).map(tp => {
          const productCode = tp.product_code;
          const productName = PRODUCTS[productCode as keyof typeof PRODUCTS] || productCode;
          return {
            code: productCode,
            name: productName,
            version: tp.version || null,
            category: translation.scope || null,
          };
        }),
      };
    });

    // Sort by priority and completion status
    const priorityOrder: Record<string, number> = { '긴급': 4, '상': 3, '중': 2, '하': 1 };

    requests.sort((a, b) => {
      // Incomplete items (no deployed_at) come first
      const aCompleted = !!a.deployed_at;
      const bCompleted = !!b.deployed_at;

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;  // Incomplete first
      }

      // Within same completion status, sort by priority (higher first)
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // For incomplete items, sort by created_at (most recent first)
      if (!aCompleted) {
        return new Date(b.request_date).getTime() - new Date(a.request_date).getTime();
      }

      // For completed items, sort by deployed_at (most recent first)
      const aDate = a.deployed_at ? new Date(a.deployed_at).getTime() : 0;
      const bDate = b.deployed_at ? new Date(b.deployed_at).getTime() : 0;
      return bDate - aDate;
    });

    // Return top 10 after sorting
    return NextResponse.json({ requests: requests.slice(0, 10) });
  } catch (error) {
    console.error('Unexpected error in dashboard requests API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
