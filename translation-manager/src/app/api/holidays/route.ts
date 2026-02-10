import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    // Return empty array instead of error to prevent blocking the UI
    return NextResponse.json({ data: [] });
  }
}
