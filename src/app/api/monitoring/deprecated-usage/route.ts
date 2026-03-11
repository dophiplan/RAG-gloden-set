import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { 
  getDeprecatedAPIStats, 
  generateWeeklyReport,
  checkAlertThreshold 
} from '@/lib/monitoring/deprecated-api-monitor';

/**
 * GET /api/monitoring/deprecated-usage
 * 
 * Deprecated API 사용량 통계 조회
 * 관리자만 접근 가능
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 체크
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData?.role || !['admin', 'master', '1st_master'].includes(userData.role)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const stats = getDeprecatedAPIStats();
    const alert = checkAlertThreshold();

    if (format === 'report') {
      const report = generateWeeklyReport();
      return new NextResponse(report, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      stats,
      alert,
      removalDate: '2026-06-11',
      daysRemaining: Math.ceil((new Date('2026-06-11').getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    });

  } catch (error) {
    console.error('Error fetching deprecated API stats:', error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
