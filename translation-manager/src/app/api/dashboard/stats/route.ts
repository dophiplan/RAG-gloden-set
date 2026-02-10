import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';

// GET - Dashboard statistics
export async function GET() {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all translations with request_id for grouping
    const [translationsResult, glossaryResult] = await Promise.all([
      supabase
        .from('translations')
        .select('id, source_text, status, created_at, request_id')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('glossary')
        .select('*', { count: 'exact', head: true }),
    ]);

    const allTranslations = translationsResult.data || [];

    // Group translations by request_id to count grouped requests
    const requestGroups = new Map<string, any[]>();
    const individualTranslations: any[] = [];

    allTranslations.forEach(trans => {
      if (trans.request_id) {
        if (!requestGroups.has(trans.request_id)) {
          requestGroups.set(trans.request_id, []);
        }
        requestGroups.get(trans.request_id)!.push(trans);
      } else {
        individualTranslations.push(trans);
      }
    });

    // Count grouped requests by status
    let pendingRequests = 0;
    let inProgressRequests = 0;
    let reviewedRequests = 0;
    let deployedRequests = 0;

    // Count grouped requests
    requestGroups.forEach((translations) => {
      const statuses = translations.map(t => t.status);
      let requestStatus: string;

      if (statuses.includes('pending')) requestStatus = 'pending';
      else if (statuses.every(s => s === 'deployed')) requestStatus = 'deployed';
      else if (statuses.every(s => s === 'reviewed' || s === 'deployed')) requestStatus = 'reviewed';
      else requestStatus = 'in_progress';

      if (requestStatus === 'pending') pendingRequests++;
      else if (requestStatus === 'in_progress') inProgressRequests++;
      else if (requestStatus === 'reviewed') reviewedRequests++;
      else if (requestStatus === 'deployed') deployedRequests++;
    });

    // Count individual translations
    individualTranslations.forEach(trans => {
      if (trans.status === 'pending') pendingRequests++;
      else if (trans.status === 'in_progress') inProgressRequests++;
      else if (trans.status === 'reviewed') reviewedRequests++;
      else if (trans.status === 'deployed') deployedRequests++;
    });

    const totalRequests = requestGroups.size + individualTranslations.length;

    // Get exact total if needed
    let exactTotal = totalRequests;
    if (allTranslations.length === 1000) {
      // For exact count, we need to count unique request_ids + individual translations
      const { data: allData } = await supabase
        .from('translations')
        .select('id, request_id');

      if (allData) {
        const allGroups = new Map<string, boolean>();
        let individuals = 0;

        allData.forEach(t => {
          if (t.request_id) {
            allGroups.set(t.request_id, true);
          } else {
            individuals++;
          }
        });

        exactTotal = allGroups.size + individuals;
      }
    }

    const rece[기밀마스킹]ranslations = allTranslations.slice(0, 5);

    return NextResponse.json({
      total: exactTotal,
      pending: pendingRequests,
      in_progress: inProgressRequests,
      reviewed: reviewedRequests,
      deployed: deployedRequests,
      glossaryCount: glossaryResult.count || 0,
      recentActivity: rece[기밀마스킹]ranslations.map((t) => ({
        id: t.id,
        action: t.status === 'pending' ? '번역 요청' : t.status === 'in_progress' ? '진행중' : t.status === 'reviewed' ? '검수 완료' : '반영 완료',
        text: t.source_text.slice(0, 50) + (t.source_text.length > 50 ? '...' : ''),
        created_at: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
