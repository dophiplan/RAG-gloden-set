import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import xlsx to avoid SSR issues
    const XLSX = await import('xlsx');

    // Create sample data
    const template = [
      {
        '담당제품': 'RC',
        '이름': '홍길동',
        '이메일주소': 'hong@rsupport.com',
        '초기비밀번호': 'password123',
      },
      {
        '담당제품': 'RV',
        '이름': '김철수',
        '이메일주소': 'kim@rsupport.com',
        '초기비밀번호': 'password123',
      },
      {
        '담당제품': 'RC',
        '이름': '김철수',
        '이메일주소': 'kim@rsupport.com',
        '초기비밀번호': 'password123',
      },
    ];

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '사용자 목록');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // 담당제품
      { wch: 10 }, // 이름
      { wch: 30 }, // 이메일주소
      { wch: 15 }, // 초기비밀번호
    ];

    // Generate Excel file as Buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="user_template.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: '템플릿 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
