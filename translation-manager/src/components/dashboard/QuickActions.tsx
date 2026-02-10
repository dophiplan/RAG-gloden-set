'use client';

import Link from 'next/link';

interface QuickActionsProps {
  glossaryCount?: number;
}

export default function QuickActions({ glossaryCount = 0 }: QuickActionsProps) {
  return (
    <div className="flex gap-2">
      {/* 번역 요청 */}
      <Link
        href="/upload"
        className="px-4 py-2 bg-white border border-[#C7D2FE] rounded-lg text-sm font-semibold text-[#64748B] hover:text-[#4F46E5] hover:border-[#818CF8] hover:bg-white/80 transition-all duration-200"
      >
        번역 요청
      </Link>

      {/* 번역 관리 */}
      <Link
        href="/translations"
        className="px-4 py-2 bg-white border border-[#C7D2FE] rounded-lg text-sm font-semibold text-[#64748B] hover:text-[#4F46E5] hover:border-[#818CF8] hover:bg-white/80 transition-all duration-200"
      >
        번역 관리
      </Link>

      {/* 용어집 관리 */}
      <Link
        href="/glossary"
        className="px-4 py-2 bg-white border border-[#C7D2FE] rounded-lg text-sm font-semibold text-[#64748B] hover:text-[#4F46E5] hover:border-[#818CF8] hover:bg-white/80 transition-all duration-200"
      >
        용어집 관리
      </Link>
    </div>
  );
}
