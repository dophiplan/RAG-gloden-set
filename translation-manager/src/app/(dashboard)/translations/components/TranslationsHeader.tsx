import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

interface TranslationsHeaderProps {
  onOpenCreateModal: () => void;
}

export default function TranslationsHeader({ onOpenCreateModal }: TranslationsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">번역 관리</h1>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push('/settings/import')}
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          CSV Import
        </Button>
        <Button
          variant="secondary"
          onClick={() => router.push('/glossary')}
        >
          용어집 관리
        </Button>
        <Button onClick={onOpenCreateModal}>새 번역 추가</Button>
      </div>
    </div>
  );
}
