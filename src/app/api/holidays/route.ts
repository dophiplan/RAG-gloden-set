import { createClient } from '@/lib/supabase/server';
import { apiSuccess } from '@/lib/api/response';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .in('country_code', ['KR', 'JP'])
      .gte('holiday_date', new Date().toISOString().split('T')[0])
      .order('holiday_date', { ascending: true });

    if (error) {
      // If table doesn't exist or other error, return empty array
      console.warn('Holidays table error:', error.message);
      return apiSuccess({ data: [] });
    }

    return apiSuccess({ data: data || [] });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    // Return empty array instead of error to prevent blocking the UI
    return apiSuccess({ data: [] });
  }
}
