import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { LanguageCode, ProductCode } from '@/types';
import { useLanguages, useProducts } from '@/hooks/useReferenceData';

interface GlossaryAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  glossaryTerm: string;
  setGlossaryTerm: (value: string) => void;
  glossaryTranslation: string;
  setGlossaryTranslation: (value: string) => void;
  glossaryLanguage: LanguageCode;
  setGlossaryLanguage: (value: LanguageCode) => void;
  glossaryContext: string;
  setGlossaryContext: (value: string) => void;
  glossaryProductCodes: ProductCode[];
  toggleGlossaryProduct: (productCode: ProductCode) => void;
  onSave: () => void;
}

export default function GlossaryAddModal({
  isOpen,
  onClose,
  glossaryTerm,
  setGlossaryTerm,
  glossaryTranslation,
  setGlossaryTranslation,
  glossaryLanguage,
  setGlossaryLanguage,
  glossaryContext,
  setGlossaryContext,
  glossaryProductCodes,
  toggleGlossaryProduct,
  onSave,
}: GlossaryAddModalProps) {
  const { languages, languagesMap } = useLanguages();
  const { products, productsMap } = useProducts();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="용어집에 추가"
    >
      <div className="space-y-4">
        <Input
          label="용어 (한국어) *"
          value={glossaryTerm}
          onChange={(e) => setGlossaryTerm(e.target.value)}
          placeholder="예: 로그인"
        />
        <Select
          label="번역 언어 *"
          value={glossaryLanguage}
          onChange={(e) => setGlossaryLanguage(e.target.value as LanguageCode)}
          options={languages
            .filter((lang) => lang.code !== 'ko')
            .map((lang) => ({
              value: lang.code,
              label: lang.name,
            }))}
        />
        <Input
          label="번역 *"
          value={glossaryTranslation}
          onChange={(e) => setGlossaryTranslation(e.target.value)}
          placeholder="예: Sign in"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명/사용 문맥 (선택사항)
          </label>
          <textarea
            value={glossaryContext}
            onChange={(e) => setGlossaryContext(e.target.value)}
            placeholder="이 용어를 어떻게 사용해야 하는지 설명해주세요..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            적용 제품 (선택사항)
          </label>
          <div className="flex flex-wrap gap-3">
            {products.map((product) => (
              <label
                key={product.code}
                className="inline-flex items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={glossaryProductCodes.includes(product.code as ProductCode)}
                  onChange={() => toggleGlossaryProduct(product.code as ProductCode)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {product.name}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onSave}>
            용어집에 추가
          </Button>
        </div>
      </div>
    </Modal>
  );
}
