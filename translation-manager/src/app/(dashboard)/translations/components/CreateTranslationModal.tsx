import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { ProductCode } from '@/types';
import { PRODUCT_SELECT_OPTIONS } from '@/lib/constants';

interface CreateTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (sourceText: string, context: string, version: string, productCode: ProductCode | '') => Promise<boolean | undefined>;
}

export default function CreateTranslationModal({
  isOpen,
  onClose,
  onCreate,
}: CreateTranslationModalProps) {
  const [newSourceText, setNewSourceText] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newProductCode, setNewProductCode] = useState<ProductCode | ''>('');

  const handleCreate = async () => {
    const success = await onCreate(newSourceText, newContext, newVersion, newProductCode);
    if (success) {
      setNewSourceText('');
      setNewContext('');
      setNewVersion('');
      setNewProductCode('');
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="새 번역 추가"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="제품"
            value={newProductCode}
            onChange={(e) => setNewProductCode(e.target.value as ProductCode | '')}
            options={PRODUCT_SELECT_OPTIONS}
          />
          <Input
            label="버전"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
            placeholder="예: 2.0.0"
          />
        </div>
        <Input
          label="원문 *"
          value={newSourceText}
          onChange={(e) => setNewSourceText(e.target.value)}
          placeholder="번역할 텍스트를 입력하세요"
        />
        <Input
          label="문맥/설명"
          value={newContext}
          onChange={(e) => setNewContext(e.target.value)}
          placeholder="이 텍스트가 사용되는 화면이나 상황을 설명하세요"
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleCreate}>추가</Button>
        </div>
      </div>
    </Modal>
  );
}
