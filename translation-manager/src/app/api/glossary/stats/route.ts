import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface GlossaryStats {
  total_terms: number;
  approved_terms: number;
  pending_terms: number;
  rejected_terms: number;
  used_terms: number;
  total_hits: number;
  hits_by_language: Record<string, number>;
  hits_this_week: number;
  hits_this_month: number;
  new_terms_this_week: number;
  new_terms_this_month: number;
  estimated_cost_saved: number;
  product_stats: Record<string, { new_count: number; total_count: number }>;
}

// GET - Get glossary statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get product filter from query params
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');

    // Get glossary terms with optional product filter
    let query = supabase
      .from('glossary')
      .select('id, approval_status, hit_count, language_code, imported_at, product_code');

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    const { data: allTerms, error: termsError } = await query;

    if (termsError) throw termsError;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate statistics
    const stats: GlossaryStats = {
      total_terms: allTerms?.length || 0,
      approved_terms: allTerms?.filter(t => t.approval_status === 'approved').length || 0,
      pending_terms: allTerms?.filter(t => t.approval_status === 'pending').length || 0,
      rejected_terms: allTerms?.filter(t => t.approval_status === 'rejected').length || 0,
      used_terms: allTerms?.filter(t => t.hit_count > 0).length || 0,
      total_hits: allTerms?.reduce((sum, t) => sum + (t.hit_count || 0), 0) || 0,
      hits_by_language: {},
      hits_this_week: 0, // Note: We don't track hit timestamps yet
      hits_this_month: 0, // Note: We don't track hit timestamps yet
      new_terms_this_week: allTerms?.filter(t =>
        t.imported_at && new Date(t.imported_at) >= weekAgo
      ).length || 0,
      new_terms_this_month: allTerms?.filter(t =>
        t.imported_at && new Date(t.imported_at) >= monthStart
      ).length || 0,
      estimated_cost_saved: 0,
      product_stats: {},
    };

    // Group hits by language
    allTerms?.forEach(term => {
      if (term.hit_count > 0) {
        stats.hits_by_language[term.language_code] =
          (stats.hits_by_language[term.language_code] || 0) + term.hit_count;
      }
    });

    // Calculate product stats (신규 / 전체)
    const productStats: Record<string, { new_count: number; total_count: number }> = {};
    allTerms?.forEach(term => {
      if (!term.product_code) return;

      if (!productStats[term.product_code]) {
        productStats[term.product_code] = { new_count: 0, total_count: 0 };
      }

      // 전체 건수
      productStats[term.product_code].total_count++;

      // 이번 달 신규 건수
      if (term.imported_at && new Date(term.imported_at) >= monthStart) {
        productStats[term.product_code].new_count++;
      }
    });
    stats.product_stats = productStats;

    // Calculate estimated cost saved
    // Assumption: AI translation costs $0.002 per language
    // Average 3 languages per translation (EN, JA, ZH)
    const COST_PER_TRANSLATION = 0.002;
    const AVG_LANGUAGES_PER_TRANSLATION = 3;
    stats.estimated_cost_saved =
      stats.total_hits * AVG_LANGUAGES_PER_TRANSLATION * COST_PER_TRANSLATION;

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching glossary stats:', error);
    return NextResponse.json(
      { error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
