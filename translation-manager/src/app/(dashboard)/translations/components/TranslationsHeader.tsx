import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

interface TranslationsHeaderProps {
  onOpenCreateModal: () => void;
}

export default function TranslationsHeader({ onOpenCreateModal }: TranslationsHeaderProps) {
  return (
    <div className="flex items-center justify-end">
      <Button onClick={onOpenCreateModal}>새 번역 추가</Button>
    </div>
  );
}
