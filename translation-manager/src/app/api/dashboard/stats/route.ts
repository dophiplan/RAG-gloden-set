import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Dashboard statistics
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get total count
    const { count: total } = await supabase
      .from('translations')
      .select('*', { count: 'exact', head: true });

    // Get pending count
    const { count: pending } = await supabase
      .from('translations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get reviewed count
    const { count: reviewed } = await supabase
      .from('translations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'reviewed');

    // Get deployed count
    const { count: deployed } = await supabase
      .from('translations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'deployed');

    // Get recent translations
    const { data: recentTranslations } = await supabase
      .from('translations')
      .select('id, source_text, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get glossary count
    const { count: glossaryCount } = await supabase
      .from('glossary')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      total: total || 0,
      pending: pending || 0,
      reviewed: reviewed || 0,
      deployed: deployed || 0,
      glossaryCount: glossaryCount || 0,
      recentActivity: recentTranslations?.map((t) => ({
        id: t.id,
        action: t.status === 'pending' ? '번역 요청' : t.status === 'reviewed' ? '검수 완료' : '반영 완료',
        text: t.source_text.slice(0, 50) + (t.source_text.length > 50 ? '...' : ''),
        created_at: t.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
