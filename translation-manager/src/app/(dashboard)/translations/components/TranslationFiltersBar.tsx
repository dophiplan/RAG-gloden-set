import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { TranslationStatus } from '@/types';

interface TranslationFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: TranslationStatus | '';
  onStatusFilterChange: (value: TranslationStatus | '') => void;
}

export default function TranslationFiltersBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: TranslationFiltersBarProps) {
  return (
    <Card>
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="원문 검색..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as TranslationStatus | '')}
            options={[
              { value: '', label: '모든 상태' },
              { value: 'pending', label: '번역 요청' },
              { value: 'reviewed', label: '검수 완료' },
              { value: 'deployed', label: '반영 완료' },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
