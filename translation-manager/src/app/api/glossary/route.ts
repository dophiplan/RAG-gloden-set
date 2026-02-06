import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GlossaryCreateInput, LanguageCode, ProductCode } from '@/types';

// GET - List glossary terms
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('language') as LanguageCode | null;
    const productCode = searchParams.get('product_code') as ProductCode | null;
    const search = searchParams.get('search');

    let query = supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `)
      .order('term', { ascending: true });

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (search) {
      query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ terms: data });
  } catch (error) {
    console.error('Error fetching glossary:', error);
    return NextResponse.json(
      { error: '용어집을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST - Create glossary term
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: GlossaryCreateInput = await request.json();

    if (!body.term?.trim() || !body.translation?.trim() || !body.language_code) {
      return NextResponse.json(
        { error: '용어, 번역, 언어 코드는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check for duplicate term (same term, language, and product)
    let duplicateQuery = supabase
      .from('glossary')
      .select('id')
      .eq('term', body.term.trim())
      .eq('language_code', body.language_code);

    if (body.product_code) {
      duplicateQuery = duplicateQuery.eq('product_code', body.product_code);
    } else {
      duplicateQuery = duplicateQuery.is('product_code', null);
    }

    const { data: existing } = await duplicateQuery.single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 용어입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('glossary')
      .insert({
        term: body.term.trim(),
        translation: body.translation.trim(),
        language_code: body.language_code,
        context: body.context?.trim() || null,
        product_code: body.product_code || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Handle product_codes if provided
    if (body.product_codes && body.product_codes.length > 0) {
      const productLinks = body.product_codes.map((code) => ({
        glossary_id: data.id,
        product_code: code,
      }));

      await supabase.from('glossary_products').insert(productLinks);
    }

    // Fetch complete glossary with products
    const { data: completeGlossary } = await supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `)
      .eq('id', data.id)
      .single();

    return NextResponse.json(completeGlossary, { status: 201 });
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return NextResponse.json(
      { error: '용어를 추가하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
