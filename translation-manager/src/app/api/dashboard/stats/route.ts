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

    // Single query: fetch recent translations with status (replaces 5 separate queries)
    const [translationsResult, glossaryResult] = await Promise.all([
      supabase
        .from('translations')
        .select('id, source_text, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('glossary')
        .select('*', { count: 'exact', head: true }),
    ]);

    const allTranslations = translationsResult.data || [];

    // Compute counts from fetched data
    const total = allTranslations.length;
    const pending = allTranslations.filter((t) => t.status === 'pending').length;
    const reviewed = allTranslations.filter((t) => t.status === 'reviewed').length;
    const deployed = allTranslations.filter((t) => t.status === 'deployed').length;

    // If there are more than 1000, get exact total count
    let exactTotal = total;
    if (total === 1000) {
      const { count } = await supabase
        .from('translations')
        .select('*', { count: 'exact', head: true });
      exactTotal = count || total;
    }

    const recentTranslations = allTranslations.slice(0, 5);

    return NextResponse.json({
      total: exactTotal,
      pending,
      reviewed,
      deployed,
      glossaryCount: glossaryResult.count || 0,
      recentActivity: recentTranslations.map((t) => ({
        id: t.id,
        action: t.status === 'pending' ? '번역 요청' : t.status === 'reviewed' ? '검수 완료' : '반영 완료',
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
