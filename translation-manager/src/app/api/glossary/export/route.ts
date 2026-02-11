import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { LanguageCode, ProductCode } from '@/types';

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
    const sourceType = searchParams.get('source_type');
    const importedAfter = searchParams.get('imported_after');
    const importedBefore = searchParams.get('imported_before');
    const search = searchParams.get('search');
    const includeMetadata = searchParams.get('include_metadata') !== 'false';

    // Build query
    let query = supabase
      .from('glossary')
      .select('*')
      .order('term', { ascending: true });

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (sourceType && ['manual', 'excel_import', 'ai_generated'].includes(sourceType)) {
      query = query.eq('source_type', sourceType);
    }

    if (importedAfter) {
      query = query.gte('imported_at', importedAfter);
    }

    if (importedBefore) {
      query = query.lte('imported_at', importedBefore);
    }

    if (search) {
      query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
    }

    const { data: terms, error } = await query;

    if (error) {
      console.error('Error fetching glossary:', error);
      return NextResponse.json(
        { error: '용어집을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!terms || terms.length === 0) {
      return NextResponse.json(
        { error: '내보낼 데이터가 없습니다.' },
        { status: 404 }
      );
    }

    // Prepare data for Excel
    interface ExcelRowData {
      term: string;
      translation: string;
      language_code: string;
      product_code: string;
      context: string;
      source_type?: string;
      imported_at?: string;
      hit_count?: number;
      approval_status?: string;
      approved_at?: string;
      created_at?: string;
    }

    const excelData = terms.map(term => {
      const baseData: ExcelRowData = {
        term: term.term,
        translation: term.translation,
        language_code: term.language_code,
        product_code: term.product_code || '',
        context: term.context || '',
      };

      if (includeMetadata) {
        baseData.source_type = term.source_type;
        baseData.imported_at = term.imported_at ? new Date(term.imported_at).toISOString() : '';
        baseData.hit_count = term.hit_count;
        baseData.created_at = new Date(term.created_at).toISOString();
      }

      return baseData;
    });

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Glossary');

    // Set column widths
    const columnWidths = [
      { wch: 30 }, // term
      { wch: 30 }, // translation
      { wch: 15 }, // language_code
      { wch: 15 }, // product_code
      { wch: 40 }, // context
    ];

    if (includeMetadata) {
      columnWidths.push(
        { wch: 15 }, // source_type
        { wch: 20 }, // imported_at
        { wch: 10 }, // hit_count
        { wch: 20 }  // created_at
      );
    }

    worksheet['!cols'] = columnWidths;

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filters = [];
    if (languageCode) filters.push(languageCode);
    if (productCode) filters.push(productCode);
    if (sourceType) filters.push(sourceType);
    const filterStr = filters.length > 0 ? `_${filters.join('_')}` : '';
    const filename = `glossary${filterStr}_${timestamp}.xlsx`;

    // Return file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting glossary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
